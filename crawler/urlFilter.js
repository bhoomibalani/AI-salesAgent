// Block low-value paths for a sales knowledge base

const { hasLocalePrefix } = require("./localePath");

const BLOCKED_PREFIXES = [
    "/privacy",
    "/policies",
    "/terms",
    "/legal",
    "/cookies",
    "/security",
    "/sitemap",
    "/rss",
    "/feed",
    "/auth",
    "/login",
    "/signup"
];

const BLOCKED_SEGMENTS = [
    "/index/",
    "/news/",
    "/stories/",
    "/research/",
    "/careers/",
    "/academy/",
    "/livestreams/",
    "/podcast/",
    "/signals/",
    "/supply/",
    "/global-affairs/",
    "/policy/",
    "/charter/",
    "/brand/",
    "/events/",
    "/resources/",
    "/blog/",
    "/guides/",
    "/docs/",
    "/documentation/",
    "/developers/",
    "/jobs/"
];

function getPath(url) {

    return new URL(url).pathname.toLowerCase();

}

function shouldCrawl(url) {

    const path = getPath(url);

    // Prefer /pricing over /in/pricing, /au/pricing, /en-at/pricing, ...
    if (hasLocalePrefix(path))
        return false;

    if (BLOCKED_PREFIXES.some(prefix => path.startsWith(prefix)))
        return false;

    if (BLOCKED_SEGMENTS.some(segment => path.includes(segment)))
        return false;

    return true;

}

module.exports = shouldCrawl;
