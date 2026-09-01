// Detect /in/pricing, /en-at/pricing, /au/ — skip locale clones of the same page

const NON_LOCALE_SEGMENTS = new Set([
    "ai",
    "api",
    "app",
    "cdn",
    "css",
    "docs",
    "faq",
    "git",
    "go",
    "id",
    "io",
    "js",
    "me",
    "ok",
    "pay",
    "rss",
    "sdk",
    "tax",
    "tv",
    "www"
]);

function getPath(urlOrPath) {

    if (!urlOrPath)
        return "/";

    try {

        if (/^https?:\/\//i.test(urlOrPath))
            return new URL(urlOrPath).pathname.toLowerCase();

    } catch (_) {

        return "/";

    }

    return String(urlOrPath).toLowerCase();

}

function stripLocalePrefix(urlOrPath) {

    const path = getPath(urlOrPath);
    const match = path.match(/^\/([a-z]{2}(?:-[a-z]{2,})?)(?=\/|$)/);

    if (!match)
        return path;

    if (NON_LOCALE_SEGMENTS.has(match[1]))
        return path;

    const rest = path.slice(match[0].length);

    return rest || "/";

}

function hasLocalePrefix(urlOrPath) {

    return stripLocalePrefix(urlOrPath) !== getPath(urlOrPath);

}

/** Rewrite https://stripe.com/in/pricing → https://stripe.com/pricing */
function stripLocaleFromUrl(url) {

    try {

        const parsed = new URL(url);
        const stripped = stripLocalePrefix(parsed.pathname);

        if (stripped === parsed.pathname.toLowerCase())
            return url;

        parsed.pathname = stripped;

        return parsed.toString();

    } catch (_) {

        return url;

    }

}

module.exports = {

    stripLocalePrefix,
    stripLocaleFromUrl,
    hasLocalePrefix,
    getPath

};
