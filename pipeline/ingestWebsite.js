const crawlWebsite = require("../crawler/crawler");
const cleanPage = require("../cleaner/cleaner");
const extractSections = require("../extractor/sectionExtractor");
const chunkPage = require("../chunker/chunker");
const { migrateSchema } = require("../database/db");
const {
    saveCrawlResults,
    getChunksWithoutEmbeddings,
    updateChunkEmbeddings,
    listWebsites,
    countStats
} = require("../database/repository");
const { embedChunks } = require("../embeddings/generator");
const embedConfig = require("../embeddings/config");
const { normalizeDomain } = require("../config/crawl");

function normalizeStartUrl(input) {

    let url = String(input || "").trim();

    if (!url)
        return null;

    if (!/^https?:\/\//i.test(url))
        url = `https://${url}`;

    try {

        const parsed = new URL(url);

        if (!["http:", "https:"].includes(parsed.protocol))
            return null;

        return parsed.toString();

    } catch (_) {

        return null;

    }

}

async function ingestWebsite(startUrl, options = {}) {

    const onProgress = typeof options.onProgress === "function"
        ? options.onProgress
        : () => {};

    const maxPages = Number(options.maxPages || 30);

    const normalized = normalizeStartUrl(startUrl);

    if (!normalized) {

        throw new Error("Enter a valid website URL (e.g. https://stripe.com)");

    }

    let hostname = normalized;

    try {
        hostname = new URL(normalized).hostname.replace(/^www\./, "");
    } catch (_) {}

    await onProgress({
        stage: "crawling",
        title: "Getting ready",
        detail: `Preparing to learn ${hostname}`,
        tip: "This can take a few minutes — we’ll show each step live.",
        percent: 1,
        currentUrl: normalized,
        log: `Queued ${normalized}`
    });

    const pages = await crawlWebsite(normalized, maxPages, {
        onProgress
    });

    if (!pages.length) {

        throw new Error("No pages were crawled. Check the URL or robots.txt.");

    }

    await onProgress({
        stage: "chunking",
        title: "Breaking pages into answer-sized pieces",
        detail: `Processing ${pages.length} pages into sections and chunks…`,
        tip: "Smaller chunks help the agent find the exact pricing or product detail.",
        percent: 68,
        pagesDone: pages.length,
        pagesTotal: pages.length,
        log: `Chunking ${pages.length} crawled pages`
    });

    const allChunks = [];

    for (let i = 0; i < pages.length; i++) {

        const page = pages[i];
        const cleaned = cleanPage(page);
        cleaned.sections = extractSections(cleaned.elements);
        const chunks = chunkPage(cleaned);
        allChunks.push(...chunks);

        if (i % 5 === 0 || i === pages.length - 1) {

            await onProgress({
                stage: "chunking",
                title: "Organizing website content",
                detail: `Chunked ${i + 1}/${pages.length} pages · ${allChunks.length} pieces so far`,
                tip: "Grouping text under real section headings for better answers.",
                percent: 68 + Math.round(((i + 1) / pages.length) * 10),
                pagesDone: i + 1,
                pagesTotal: pages.length,
                log: `Chunked page ${i + 1}/${pages.length}`
            });

        }

    }

    await onProgress({
        stage: "saving",
        title: "Saving into the knowledge base",
        detail: `Writing ${allChunks.length} chunks to PostgreSQL…`,
        tip: "Other websites already in the database stay untouched.",
        percent: 80,
        log: `Saving ${allChunks.length} chunks`
    });

    await migrateSchema();

    const website = await saveCrawlResults(normalized, pages, allChunks);
    const domain = normalizeDomain(website.domain || hostname);

    await onProgress({
        stage: "embedding",
        title: "Teaching the search model",
        detail: `Creating embeddings for ${domain}…`,
        tip: "Local embeddings turn text into vectors so similar questions can find it.",
        percent: 84,
        log: `Embedding chunks for ${domain}`
    });

    const pending = await getChunksWithoutEmbeddings(domain);

    let embeddedNow = 0;

    if (pending.length) {

        const items = await embedChunks(pending, {
            model: embedConfig.model,
            batchSize: embedConfig.batchSize,
            onProgress(done, total) {

                onProgress({
                    stage: "embedding",
                    title: "Turning text into searchable meaning",
                    detail: `Embedded ${done}/${total} chunks`,
                    tip: "Almost there — after this you can ask sales questions about the site.",
                    percent: 84 + Math.round((done / Math.max(total, 1)) * 14),
                    log: `Embedded ${done}/${total}`
                });

            }
        });

        await updateChunkEmbeddings(items, embedConfig.model);
        embeddedNow = items.length;

    }

    const [sites, stats] = await Promise.all([
        listWebsites(),
        countStats()
    ]);

    const site = sites.find(s => s.domain === domain) || null;

    await onProgress({
        stage: "done",
        title: "Ready to answer questions",
        detail: `${domain} is in the knowledge base`,
        tip: "Try asking about pricing, services, or how to contact sales.",
        percent: 100,
        log: `Done — ${pages.length} pages, ${allChunks.length} chunks`
    });

    return {
        url: normalized,
        domain,
        pages: pages.length,
        chunks: allChunks.length,
        embeddedNow,
        site,
        stats
    };

}

module.exports = {

    normalizeStartUrl,
    ingestWebsite

};
