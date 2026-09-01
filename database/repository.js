const { query, withTransaction } = require("./db");
const { rerankSearchResults, detectIntent } = require("./searchRank");

const BATCH_SIZE = 150;

function toVectorLiteral(embedding = []) {

    return `[${embedding.join(",")}]`;

}

function chunkArray(items, size = BATCH_SIZE) {

    const batches = [];

    for (let i = 0; i < items.length; i += size)
        batches.push(items.slice(i, i + size));

    return batches;

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

    const pageCache = await upsertPagesBatch(websiteId, [{ url, title: title || "" }]);

    return pageCache.get(url) || null;

}

async function upsertPagesBatch(websiteId, pages, client = null) {

    const run = client ? client.query.bind(client) : query;
    const pageCache = new Map();

    if (!pages.length)
        return pageCache;

    // One row per URL — Postgres rejects ON CONFLICT updating the same key twice
    const byUrl = new Map();

    for (const page of pages) {

        if (!page?.url)
            continue;

        byUrl.set(page.url, page);

    }

    const uniquePages = [...byUrl.values()];
    const urls = uniquePages.map(page => page.url);
    const titles = uniquePages.map(page => page.metadata?.title || page.title || "");

    const result = await run(
        `
        INSERT INTO pages (website_id, url, title, updated_at)
        SELECT $1, u.url, u.title, NOW()
        FROM unnest($2::text[], $3::text[]) AS u(url, title)
        ON CONFLICT (url) DO UPDATE SET
            website_id = EXCLUDED.website_id,
            title = EXCLUDED.title,
            updated_at = NOW()
        RETURNING id, url
        `,
        [websiteId, urls, titles]
    );

    for (const row of result.rows)
        pageCache.set(row.url, row);

    return pageCache;

}

async function insertChunksBatch(rows, client = null) {

    if (!rows.length)
        return;

    const run = client ? client.query.bind(client) : query;

    // Same chunk id twice in one INSERT → ON CONFLICT error
    const byId = new Map();

    for (const row of rows) {

        if (!row?.id)
            continue;

        byId.set(row.id, row);

    }

    for (const batch of chunkArray([...byId.values()])) {

        const ids = [];
        const pageIds = [];
        const headings = [];
        const levels = [];
        const indexes = [];
        const texts = [];

        for (const row of batch) {

            ids.push(row.id);
            pageIds.push(row.pageId);
            headings.push(row.heading || "");
            levels.push(row.level || "");
            indexes.push(row.chunkIndex ?? 0);
            texts.push(row.text);

        }

        await run(
            `
            INSERT INTO chunks (
                id,
                page_id,
                heading,
                level,
                chunk_index,
                text
            )
            SELECT
                t.id,
                t.page_id,
                t.heading,
                t.level,
                t.chunk_index,
                t.text
            FROM unnest(
                $1::text[],
                $2::int[],
                $3::text[],
                $4::text[],
                $5::int[],
                $6::text[]
            ) AS t(id, page_id, heading, level, chunk_index, text)
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
            [ids, pageIds, headings, levels, indexes, texts]
        );

    }

}

async function saveCrawlResults(startUrl, pages, chunks) {

    const website = await upsertWebsite(startUrl);

    await withTransaction(async client => {

        const pageCache = await upsertPagesBatch(website.id, pages, client);

        await client.query(
            `
            DELETE FROM chunks
            WHERE page_id IN (
                SELECT id FROM pages WHERE website_id = $1
            )
            `,
            [website.id]
        );

        const chunkRows = [];

        for (const chunk of chunks) {

            const page = pageCache.get(chunk.url);

            if (!page)
                continue;

            chunkRows.push({
                id: chunk.id,
                pageId: page.id,
                heading: chunk.heading || "",
                level: chunk.level || "",
                chunkIndex: chunk.chunkIndex ?? 0,
                text: chunk.text
            });

        }

        await insertChunksBatch(chunkRows, client);

    });

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

    await updateChunkEmbeddings([{ id, embedding }], model);

}

async function updateChunkEmbeddings(items, model) {

    if (!items.length)
        return;

    for (const batch of chunkArray(items)) {

        const ids = [];
        const models = [];
        const embeddings = [];

        for (const item of batch) {

            ids.push(item.id);
            models.push(model);
            embeddings.push(toVectorLiteral(item.embedding));

        }

        await query(
            `
            UPDATE chunks AS c
            SET
                model = d.model,
                embedding = d.embedding::vector,
                embedded_at = NOW()
            FROM (
                SELECT *
                FROM unnest($1::text[], $2::text[], $3::text[])
                    AS t(id, model, embedding)
            ) AS d
            WHERE c.id = d.id
            `,
            [ids, models, embeddings]
        );

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
    upsertPagesBatch,
    insertChunksBatch,
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
