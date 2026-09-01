const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const { resolveStartUrl } = require("./config/crawl");
const crawlWebsite = require("./crawler/crawler");
const cleanPage = require("./cleaner/cleaner");
const extractSections = require("./extractor/sectionExtractor");
const chunkPage = require("./chunker/chunker");
const { closePool, migrateSchema } = require("./database/db");
const { saveCrawlResults, countStats, listWebsites } = require("./database/repository");

(async () => {

    const START_URL = resolveStartUrl();

    if (!START_URL) {

        console.error("Usage: node index.js <website-url>");
        console.error("Example: node index.js https://openai.com");
        console.error("Or set START_URL in .env");
        process.exit(1);

    }

    console.log("--------------------------------");
    console.log("Voice Sales Agent Crawler");
    console.log("--------------------------------");
    console.log("Target URL:", START_URL);
    console.log("");

    const pages = await crawlWebsite(START_URL);

    console.log("\n--------------------------------");
    console.log("Crawl Finished");
    console.log("--------------------------------");
    console.log("Pages Crawled :", pages.length);

    if (!pages.length) {

        console.error("\nNo pages with real content were crawled.");
        console.error("Chunks cannot be created from empty/blocked pages.");
        console.error("Tip: openai.com often blocks bots — try https://www.zipplyio.com/ or https://stripe.com");
        process.exit(1);

    }

    console.log("\n--------------------------------");
    console.log("Chunking + saving to PostgreSQL...");
    console.log("--------------------------------");

    const allChunks = [];

    for (const page of pages) {

        const cleaned = cleanPage(page);

        cleaned.sections = extractSections(cleaned.elements);

        const chunks = chunkPage(cleaned);

        allChunks.push(...chunks);

    }

    if (!allChunks.length) {

        console.error("\nCrawl returned pages but produced 0 chunks.");
        console.error("Extraction/cleaning left no paragraph text to chunk.");
        process.exit(1);

    }

    await migrateSchema();

    const website = await saveCrawlResults(START_URL, pages, allChunks);

    const stats = await countStats();
    const sites = await listWebsites();

    await closePool();

    console.log("Website saved :", website.domain);
    console.log("Chunks saved  :", allChunks.length);
    console.log("");
    console.log("DB totals:");
    console.log("  websites :", stats.websites);
    console.log("  pages    :", stats.pages);
    console.log("  chunks   :", stats.chunks);
    console.log("  embedded :", stats.embedded);
    console.log("");
    console.log("All websites in DB:");

    for (const site of sites) {

        console.log(
            `  - ${site.domain}: ${site.pages} pages, ${site.chunks} chunks (${site.embedded} embedded)`
        );

    }

    console.log("");
    console.log("Next: npm run embed");

})().catch(async err => {

    console.error("\nPipeline failed:");
    console.error(err.message || err.code || String(err));

    if (err.code === "ECONNREFUSED") {
        console.error("PostgreSQL is not reachable. Start it with: npm run db:up");
    }

    try {
        await closePool();
    } catch (_) {}

    process.exit(1);

});

//bhoomi123balani
