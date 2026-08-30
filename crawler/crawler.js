const { chromium } = require("playwright");

const Scheduler = require("./scheduler");
const normalizeUrl = require("./normalizer");
const RobotsManager = require("./robots");
const score = require("./pageScorer");
const shouldCrawl = require("./urlFilter");
const { getSalesSeedUrls } = require("./salesSeeds");
const { stripLocaleFromUrl } = require("./localePath");
const isBinary = require("./binaryFilter");
const getCanonical = require("./canonical");
const detectRedirect = require("./redirect");

const extractPage = require("../extractor/extractor");
const cleanPage = require("../cleaner/cleaner");

const MAX_DEPTH = 5;

async function crawl(startUrl, maxPages = 50, options = {}) {

    const onProgress = typeof options.onProgress === "function"
        ? options.onProgress
        : () => {};

    const browser = await chromium.launch({
        headless: true
    });

    const context = await browser.newContext({
        locale: "en-US",
        extraHTTPHeaders: {
            "Accept-Language": "en-US,en;q=0.9"
        }
    });

    const scheduler = new Scheduler();

    const robots = new RobotsManager();

    await onProgress({
        stage: "crawling",
        title: "Opening the company website",
        detail: "Launching a browser and checking robots.txt…",
        tip: "We only visit pages that look useful for sales answers.",
        percent: 2,
        currentUrl: startUrl
    });

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

    for (const seedUrl of getSalesSeedUrls(startUrl)) {

        const normalizedSeed = normalizeUrl(seedUrl);

        if (!normalizedSeed || visited.has(normalizedSeed) || queued.has(normalizedSeed))
            continue;

        if (!shouldCrawl(normalizedSeed))
            continue;

        queued.add(normalizedSeed);

        scheduler.add({
            url: normalizedSeed,
            priority: score(normalizedSeed),
            depth: 0
        });

    }

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

        const pagesDone = crawledPages.length;
        const percent = Math.min(
            8 + Math.round((pagesDone / Math.max(maxPages, 1)) * 55),
            62
        );

        await onProgress({
            stage: "crawling",
            title: "Browsing the company site",
            detail: `Visiting page ${pagesDone + 1} of up to ${maxPages}`,
            tip: "Looking for pricing, products, features, and contact pages.",
            percent,
            currentUrl: normalized,
            pagesDone,
            pagesTotal: maxPages,
            log: `Opening ${normalized}`
        });

        const page = await context.newPage();

        try {

            const response = await page.goto(
                normalized,
                {
                    waitUntil: "domcontentloaded",
                    timeout: 30000
                }
            );

            // Let SPA/pricing cards finish rendering (Zipply, Stripe, etc.)
            try {

                await page.waitForFunction(
                    () => (document.body?.innerText || "").trim().length > 120,
                    { timeout: 8000 }
                );

            } catch (_) {}

            await new Promise(resolve => setTimeout(resolve, 1200));

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

            // Stripe (and others) geo-redirect /pricing → /in/pricing.
            // Store the locale-free path so one site ≠ N country clones.
            if (normalized) {

                normalized = normalizeUrl(stripLocaleFromUrl(normalized));

            }

            const extracted = await extractPage(page);

            const cleaned = cleanPage(extracted);

            // Browser location stays on geo URL; persist the locale-free one
            cleaned.url = normalized;
            if (cleaned.metadata)
                cleaned.metadata.url = normalized;

            crawledPages.push(cleaned);

            const title = extracted.metadata?.title || "Untitled page";
            const pathLabel = (() => {
                try {
                    return new URL(normalized).pathname || "/";
                } catch (_) {
                    return normalized;
                }
            })();

            console.log("Title:", title);

            await onProgress({
                stage: "crawling",
                title: "Extracting page content",
                detail: `Saved “${title.slice(0, 72)}${title.length > 72 ? "…" : ""}”`,
                tip: "Pulling headings, paragraphs, and lists — skipping nav chrome.",
                percent: Math.min(
                    10 + Math.round((crawledPages.length / Math.max(maxPages, 1)) * 55),
                    65
                ),
                currentUrl: normalized,
                pagesDone: crawledPages.length,
                pagesTotal: maxPages,
                log: `Extracted ${pathLabel} · ${cleaned.headings.length} headings, ${cleaned.paragraphs.length} paragraphs`
            });

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

                    let normalizedLink = normalizeUrl(link);

                    if (!normalizedLink)
                        continue;

                    // Queue /pricing instead of /in/pricing
                    normalizedLink = normalizeUrl(
                        stripLocaleFromUrl(normalizedLink)
                    );

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