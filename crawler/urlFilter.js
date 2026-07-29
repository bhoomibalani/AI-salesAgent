const BLOCKED_PREFIXES = [

    "/privacy",
    "/policies",
    "/terms",
    "/legal",
    "/cookies",
    "/security",
    "/sitemap",
    "/rss",
    "/feed"

];

function shouldCrawl(url) {

    const path = new URL(url)
        .pathname
        .toLowerCase();

    return !BLOCKED_PREFIXES.some(prefix =>
        path.startsWith(prefix)
    );

}

module.exports = shouldCrawl;