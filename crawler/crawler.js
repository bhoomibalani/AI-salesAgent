const { chromium } = require("playwright");

const Scheduler = require("./scheduler");
const normalizeUrl = require("./normalizer");
const RobotsManager = require("./robots");
const score = require("./pageScorer");
const shouldCrawl = require("./urlFilter");
const isBinary = require("./binaryFilter");
const getCanonical = require("./canonical");
const detectRedirect = require("./redirect");

const extractPage = require("../extractor/extractor");
const cleanPage = require("../cleaner/cleaner");

const MAX_DEPTH = 5;

async function crawl(startUrl, maxPages = 50) {

    const browser = await chromium.launch({
        headless: false
    });

    const scheduler = new Scheduler();

    const robots = new RobotsManager();

    await robots.load(startUrl);

    const visited = new Set();

    const queued = new Set();

    const crawledPages = [];

    const normalizedStart = normalizeUrl(startUrl);

    queued.add(normalizedStart);

    scheduler.add({
        url: normalizedStart,
        priority: 100,
        depth: 0
    });

    while (
        !scheduler.isEmpty() &&
        crawledPages.length < maxPages
    ) {

        const current = scheduler.next();

        let normalized = normalizeUrl(current.url);

        const depth = current.depth;

        queued.delete(normalized);

        if (depth > MAX_DEPTH)
            continue;

        if (visited.has(normalized))
            continue;

        if (!robots.isAllowed(normalized)) {

            console.log("Blocked by robots:", normalized);

            continue;

        }

        visited.add(normalized);

        console.log("\n==============================");
        console.log("Visiting:", normalized);
        console.log("==============================");

        const page = await browser.newPage();

        try {

            const response = await page.goto(
                normalized,
                {
                    waitUntil: "domcontentloaded",
                    timeout: 30000
                }
            );

            // Redirect Detection
            const redirected = detectRedirect(response);

            if (redirected) {

                normalized = normalizeUrl(redirected);

            }

            // Canonical URL Detection
            const canonical = await getCanonical(page);

            if (canonical) {

                normalized = normalizeUrl(canonical);

            }

            const extracted = await extractPage(page);

            const cleaned = cleanPage(extracted);

            crawledPages.push(cleaned);

            console.log("Title:", extracted.metadata.title);

            console.log(
                "Headings:",
                extracted.headings.length,
                "->",
                cleaned.headings.length
            );

            console.log(
                "Paragraphs:",
                extracted.paragraphs.length,
                "->",
                cleaned.paragraphs.length
            );

            console.log(
                "Buttons:",
                extracted.buttons.length,
                "->",
                cleaned.buttons.length
            );

            console.log(
                "Links:",
                extracted.links.length,
                "->",
                cleaned.links.length
            );

            console.log(
                "Images:",
                extracted.images.length,
                "->",
                cleaned.images.length
            );

            const links = await page.$$eval(
                "a[href]",
                anchors => anchors.map(a => a.href)
            );

            const currentHost = new URL(startUrl)
                .hostname
                .replace(/^www\./, "");

            for (const link of links) {

                try {

                    if (
                        !link.startsWith("http://") &&
                        !link.startsWith("https://")
                    ) {
                        continue;
                    }

                    const normalizedLink = normalizeUrl(link);

                    if (!normalizedLink)
                        continue;

                    const urlObj = new URL(normalizedLink);

                    const host = urlObj.hostname.replace(/^www\./, "");

                    if (host !== currentHost)
                        continue;

                    if (!shouldCrawl(normalizedLink))
                        continue;

                    if (isBinary(normalizedLink))
                        continue;

                    if (!robots.isAllowed(normalizedLink))
                        continue;

                    if (visited.has(normalizedLink))
                        continue;

                    if (queued.has(normalizedLink))
                        continue;

                    const priority = score(normalizedLink);

                    queued.add(normalizedLink);

                    scheduler.add({
                        url: normalizedLink,
                        priority,
                        depth: depth + 1
                    });

                }

                catch (err) {

                    console.log(err.message);

                }

            }

            console.log("Total Links:", links.length);
            console.log("Queue:", scheduler.size());
            console.log("Visited:", visited.size);

        }

        catch (err) {

            console.log("Failed:", normalized);
            console.log(err.message);

        }

        finally {

            await page.close();

        }

        const delay = robots.getCrawlDelay();

        if (delay > 0) {

            console.log(`Waiting ${delay} seconds...`);

            await new Promise(resolve =>
                setTimeout(resolve, delay * 1000)
            );

        }

    }

    await browser.close();

    return crawledPages;

}

module.exports = crawl;