// Prioritize sales + product pages for overall Q&A (not pricing alone)

const { hasLocalePrefix } = require("./localePath");

const HIGH_PRIORITY = {
    // Core offerings
    products: 100,
    product: 100,
    payments: 98,
    billing: 96,
    platform: 95,
    features: 94,
    feature: 94,
    solutions: 93,
    services: 92,
    enterprise: 92,
    business: 90,
    // Pricing
    pricing: 95,
    plans: 90,
    // Sales
    "contact-sales": 88,
    demo: 85,
    contact: 82,
    sales: 80,
    faq: 78,
    compare: 75,
    // Social proof (useful, but below product pages)
    customers: 55,
    "use-cases": 50,
    "use-case": 50
};

const LOW_PRIORITY = {
    "release-notes": 25,
    blog: 15,
    news: 10,
    stories: 10,
    resources: 12,
    guides: 12,
    index: 5,
    research: 5,
    careers: 5
};

function getPath(url) {

    return new URL(url).pathname.toLowerCase();

}

function score(url) {

    const path = getPath(url);

    let maxScore = 35;

    for (const [keyword, value] of Object.entries(HIGH_PRIORITY)) {

        if (path.includes(keyword))
            maxScore = Math.max(maxScore, value);

    }

    for (const [keyword, value] of Object.entries(LOW_PRIORITY)) {

        if (path.includes(keyword))
            maxScore = Math.min(maxScore, value);

    }

    // Locale clones of the same page are near-duplicates
    if (hasLocalePrefix(path))
        maxScore = Math.min(maxScore, 20);

    // Prefer short overview URLs over deep customer story paths
    const depth = path.split("/").filter(Boolean).length;

    if (depth >= 3 && (path.includes("/customers/") || path.includes("/use-cases/")))
        maxScore = Math.min(maxScore, 40);

    return maxScore;

}

module.exports = score;
