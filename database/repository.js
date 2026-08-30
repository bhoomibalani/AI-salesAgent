const { query } = require("./db");
const { rerankSearchResults, detectIntent } = require("./searchRank");

function toVectorLiteral(embedding = []) {

    return `[${embedding.join(",")}]`;

}

function getDomain(url) {

    try {

        return new URL(url).hostname.replace(/^www\./, "");

    } catch {

        return "unknown";

    }

}

async function upsertWebsite(startUrl) {

    const domain = getDomain(startUrl);

    const result = await query(
        `
        INSERT INTO websites (domain, start_url)
        VALUES ($1, $2)
        ON CONFLICT (domain) DO UPDATE SET
            start_url = COALESCE(EXCLUDED.start_url, websites.start_url)
        RETURNING id, domain
        `,
        [domain, startUrl || null]
    );

    return result.rows[0];

}

async function upsertPage(websiteId, url, title = "") {

    const result = await query(
        `
        INSERT INTO pages (website_id, url, title, updated_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (url) DO UPDATE SET
            website_id = EXCLUDED.website_id,
            title = EXCLUDED.title,
            updated_at = NOW()
        RETURNING id, url
        `,
        [websiteId, url, title || ""]
    );

    return result.rows[0];

}

async function getPageByUrl(url) {

    const result = await query(
        `SELECT id, url FROM pages WHERE url = $1`,
        [url]
    );

    return result.rows[0] || null;

}

async function saveCrawlResults(startUrl, pages, chunks) {

    const website = await upsertWebsite(startUrl);
    const pageCache = new Map();

    for (const page of pages) {

        const row = await upsertPage(
            website.id,
            page.url,
            page.metadata?.title || ""
        );

        pageCache.set(page.url, row);

    }

    await query(
        `
        DELETE FROM chunks
        WHERE page_id IN (
            SELECT id FROM pages WHERE website_id = $1
        )
        `,
        [website.id]
    );

    for (const chunk of chunks) {

        let page = pageCache.get(chunk.url);

        if (!page)
            page = await getPageByUrl(chunk.url);

        if (!page)
            continue;

        await query(
            `
            INSERT INTO chunks (
                id,
                page_id,
                heading,
                level,
                chunk_index,
                text
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
                page_id = EXCLUDED.page_id,
                heading = EXCLUDED.heading,
                level = EXCLUDED.level,
                chunk_index = EXCLUDED.chunk_index,
                text = EXCLUDED.text,
                model = NULL,
                embedding = NULL,
                embedded_at = NULL
            `,
            [
                chunk.id,
                page.id,
                chunk.heading || "",
                chunk.level || "",
                chunk.chunkIndex ?? 0,
                chunk.text
            ]
        );

    }

    return website;

}

async function listWebsites() {

    const result = await query(`
        SELECT
            w.id,
            w.domain,
            w.start_url,
            COUNT(DISTINCT p.id)::INT AS pages,
            COUNT(c.id)::INT AS chunks,
            COUNT(c.embedding)::INT AS embedded,
            w.created_at
        FROM websites w
        LEFT JOIN pages p ON p.website_id = w.id
        LEFT JOIN chunks c ON c.page_id = p.id
        GROUP BY w.id
        ORDER BY w.domain
    `);

    return result.rows;

}

async function getChunksWithoutEmbeddings(domain = null) {

    const params = [];
    let domainFilter = "";

    if (domain) {

        params.push(domain.replace(/^www\./, "").toLowerCase());
        domainFilter = `AND w.domain = $${params.length}`;

    }

    const result = await query(`
        SELECT
            c.id,
            p.url,
            p.title,
            c.heading,
            c.level,
            c.chunk_index AS "chunkIndex",
            c.text,
            w.domain
        FROM chunks c
        JOIN pages p ON p.id = c.page_id
        JOIN websites w ON w.id = p.website_id
        WHERE c.embedding IS NULL
        ${domainFilter}
        ORDER BY w.domain, p.url, c.chunk_index
    `, params);

    return result.rows;

}

function dedupeSearchRows(rows, limit) {

    const { stripLocalePrefix } = require("../crawler/localePath");
    const seen = new Set();
    const unique = [];

    for (const row of rows) {

        let pathKey;

        try {
            pathKey = stripLocalePrefix(row.url);
        } catch (_) {
            pathKey = row.url;
        }

        // Collapse /in/pricing + /au/pricing, keep different sections
        const key = `${row.domain || ""}:${pathKey}:${(row.heading || "").toLowerCase()}`;

        if (seen.has(key))
            continue;

        seen.add(key);
        unique.push(row);

        if (unique.length >= limit)
            break;

    }

    return unique;

}

function dropWeakChunks(rows, question = "") {

    const intent = detectIntent(question);

    if (intent.customers)
        return rows;

    return rows.filter(row => {

        const heading = String(row.heading || "");
        const text = String(row.text || "");

        // Keep testimonials out of default Q&A answers
        if (/\bwith stripe\b/i.test(heading))
            return false;

        if (/\b(streamlines?|grows into|case study)\b/i.test(heading))
            return false;

        if (/\bapproval rates?\b/i.test(text.slice(0, 400)))
            return false;

        if (/^ready to launch\b/i.test(heading.trim()))
            return false;

        return true;

    });

}

async function searchSimilar(embedding, limit = 5, domain = null, question = "") {

    // Over-fetch so locale clones / lexical rerank have room
    const fetchLimit = Math.max(limit * 12, 60);
    const params = [toVectorLiteral(embedding), fetchLimit];
    let domainFilter = "";

    if (domain) {

        params.push(domain.replace(/^www\./, "").toLowerCase());
        domainFilter = `AND w.domain = $${params.length}`;

    }

    const sql = `
        SELECT
            c.id,
            p.url,
            p.title,
            c.heading,
            c.chunk_index,
            c.text,
            c.model,
            w.domain,
            1 - (c.embedding <=> $1::vector) AS similarity
        FROM chunks c
        JOIN pages p ON p.id = c.page_id
        JOIN websites w ON w.id = p.website_id
        WHERE c.embedding IS NOT NULL
        ${domainFilter}
        ORDER BY c.embedding <=> $1::vector
        LIMIT $2
    `;

    const result = await query(sql, params);
    const ranked = dropWeakChunks(
        rerankSearchResults(result.rows, question),
        question
    );

    return dedupeSearchRows(ranked, limit);

}

async function updateChunkEmbedding(id, embedding, model) {

    await query(
        `
        UPDATE chunks
        SET
            model = $2,
            embedding = $3::vector,
            embedded_at = NOW()
        WHERE id = $1
        `,
        [id, model, toVectorLiteral(embedding)]
    );

}

async function updateChunkEmbeddings(items, model) {

    for (const item of items) {

        await updateChunkEmbedding(item.id, item.embedding, model);

    }

}

async function countStats() {

    const result = await query(`
        SELECT
            (SELECT COUNT(*)::INT FROM websites) AS websites,
            (SELECT COUNT(*)::INT FROM pages) AS pages,
            (SELECT COUNT(*)::INT FROM chunks) AS chunks,
            (SELECT COUNT(*)::INT FROM chunks WHERE embedding IS NOT NULL) AS embedded
    `);

    return result.rows[0];

}

async function countChunks() {

    const stats = await countStats();
    return stats.chunks;

}

async function clearAll() {

    await query("DELETE FROM chunks");
    await query("DELETE FROM pages");
    await query("DELETE FROM websites");

}

module.exports = {

    upsertWebsite,
    upsertPage,
    saveCrawlResults,
    listWebsites,
    getChunksWithoutEmbeddings,
    updateChunkEmbedding,
    updateChunkEmbeddings,
    countChunks,
    countStats,
    searchSimilar,
    clearAll,
    toVectorLiteral,
    getDomain

};
