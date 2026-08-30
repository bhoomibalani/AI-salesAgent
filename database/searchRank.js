// Boost or penalize vector hits using query intent + URL/heading/content
// Tuned for overall sales Q&A — including "what is <product>" questions

function getPath(url) {

    try {
        return new URL(url).pathname.toLowerCase();
    } catch (_) {
        return "/";
    }

}

function detectIntent(question = "") {

    const q = question.toLowerCase();

    return {
        pricing:
            /\b(pric(e|ing)|plans?|costs?|fees?|how much|subscriptions?|billing rates?)\b/.test(q),
        products:
            /\b(services?|products?|offer(ings?)?|features?|solutions?|platform|capabilities|what do you (do|offer|provide)|what (can|does)|how (does|do) (it|you)|payments?|billing)\b/.test(q),
        definition:
            /\bwhat (is|are|does)\b|\bexplain\b|\btell me about\b|\bwho (is|are)\b/.test(q),
        contact:
            /\b(contact|talk to|speak (to|with)|sales (team|rep)|demo|book|schedule|quote|enterprise)\b/.test(q),
        customers:
            /\b(customers?|case stud(y|ies)|who uses|examples?|testimonials?)\b/.test(q),
        support:
            /\b(support|help desk|24\s*x?\s*7|customer service)\b/.test(q),
        faq:
            /\b(faq|frequently asked|how (do|does|can) i|discount|refund)\b/.test(q)
    };

}

function extractQueryTerms(question = "") {

    const stop = new Set([
        "what", "is", "are", "the", "a", "an", "do", "does", "did",
        "you", "your", "how", "can", "i", "to", "of", "for", "and",
        "or", "on", "in", "with", "about", "tell", "me", "please",
        "who", "which", "this", "that", "from", "into"
    ]);

    return String(question)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .map(t => t.trim())
        .filter(t => t.length > 2 && !stop.has(t));

}

function lexicalBoost(question, heading, text) {

    const terms = extractQueryTerms(question);

    if (!terms.length)
        return 0;

    const hay = `${heading}\n${text}`.toLowerCase();
    let hits = 0;

    for (const term of terms) {

        if (hay.includes(term))
            hits += 1;

    }

    const phrase = terms.join(" ");

    // Exact multi-word product mention e.g. "zipply connect"
    if (terms.length >= 2 && hay.includes(phrase))
        return 0.28;

    return (hits / terms.length) * 0.2;

}

function pathMatches(path, keywords) {

    return keywords.some(k => path.includes(k));

}

function isTestimonialChunk(heading, text) {

    const h = heading;
    const t = String(text || "").toLowerCase().slice(0, 400);

    if (/\bwith stripe\b/i.test(h))
        return true;

    if (/\b(streamlines?|grows into|case study|customer stor)/i.test(h))
        return true;

    if (/\b(approval rates?|read .{0,40}'s story|juggernaut)\b/i.test(t))
        return true;

    return false;

}

function isSupportChrome(heading) {

    return /^(support( plans?)?\.?|24\s*x?\s*7 support|help( center)?)$/i.test(heading.trim());

}

function isCtaNoise(heading) {

    return /^ready to launch\b/i.test(String(heading || "").trim());

}

function looksLikeOffering(heading, text) {

    const h = heading.toLowerCase();
    const t = String(text || "").toLowerCase().slice(0, 400);

    if (/\b(payments?|billing|checkout|invoic|subscription|fraud|treasury|issuing|connect|identity|radar|platform|professional services|whatsapp|crm|accept (cards?|payments?)|process(ing)? payments?)\b/.test(h))
        return true;

    if (/\b(accept payments?|payment processing|financial services|revenue|orchestrate payments|custom package|whatsapp|sell on|for any business)\b/.test(t))
        return true;

    return false;

}

function rerankSearchResults(rows, question = "") {

    const intent = detectIntent(question);

    const productPaths = [
        "/products",
        "/product",
        "/payments",
        "/billing",
        "/features",
        "/solutions",
        "/platform",
        "/services",
        "/enterprise",
        "/business",
        "/connect",
        "/radar",
        "/treasury",
        "/issuing",
        "/identity"
    ];

    const pricingPaths = ["pricing", "/plans", "/plan"];
    const contactPaths = ["contact", "contact-sales", "demo", "sales"];
    const storyPaths = ["/customers/", "/use-cases/", "/stories/", "/case-stud"];
    const noisePaths = ["/resources/", "/blog/", "/guides/", "/news/"];

    return rows
        .map(row => {

            let boost = 0;
            const path = getPath(row.url);
            const heading = String(row.heading || "");
            const headingLower = heading.toLowerCase();
            const text = row.text || "";

            // Keyword / product-name overlap beats weak semantic matches
            boost += lexicalBoost(question, heading, text);

            const terms = extractQueryTerms(question);

            if (terms.some(t => headingLower.includes(t)))
                boost += 0.06;

            if (pathMatches(path, noisePaths))
                boost -= 0.12;

            if (headingLower === "navigate to:" || headingLower.startsWith("navigate to"))
                boost -= 0.2;

            if (isCtaNoise(heading))
                boost -= 0.25;

            if (!intent.customers && isTestimonialChunk(heading, text))
                boost -= 0.28;

            if (!intent.support && isSupportChrome(heading))
                boost -= 0.14;

            if (intent.products && !intent.pricing) {

                if (/professional services\.?$/i.test(heading.trim()))
                    boost -= 0.06;

            }

            // "What is Zipply Connect?" → prefer homepage / overview blurbs
            if (intent.definition) {

                if (path === "/" || path === "")
                    boost += 0.12;

                if (looksLikeOffering(heading, text))
                    boost += 0.1;

                // Deep Academy feature pages are usually wrong for product definitions
                if (path.includes("/features/") && lexicalBoost(question, heading, text) < 0.1)
                    boost -= 0.12;

            }

            if (intent.pricing) {

                if (pathMatches(path, pricingPaths))
                    boost += 0.14;

                if (pathMatches(path, storyPaths))
                    boost -= 0.1;

                if (looksLikeOffering(heading, text) && pathMatches(path, pricingPaths))
                    boost += 0.04;

            }

            if ((intent.products || intent.definition) && !intent.pricing) {

                if (pathMatches(path, productPaths))
                    boost += 0.08;

                if (/^\/(payments|billing|products|platform|solutions|features|connect)\/?$/.test(path))
                    boost += 0.06;

                if (path === "/" || path === "")
                    boost += 0.06;

                if (looksLikeOffering(heading, text))
                    boost += 0.1;

                if (pathMatches(path, storyPaths))
                    boost -= 0.16;

                if (pathMatches(path, pricingPaths) && !intent.definition)
                    boost -= 0.02;

            }

            if (intent.contact) {

                if (pathMatches(path, contactPaths) || path.includes("enterprise"))
                    boost += 0.12;

            }

            if (intent.customers) {

                if (pathMatches(path, storyPaths) || isTestimonialChunk(heading, text))
                    boost += 0.12;

            } else if (pathMatches(path, storyPaths)) {

                boost -= 0.08;

            }

            if (intent.faq || intent.support) {

                if (path.includes("faq") || path.includes("support") || isSupportChrome(heading))
                    boost += 0.1;

            }

            if ((path === "/" || path === "") && !intent.products && !intent.definition)
                boost -= 0.04;

            return {
                ...row,
                similarity: Number(row.similarity) + boost
            };

        })
        .sort((a, b) => b.similarity - a.similarity);

}

module.exports = {

    rerankSearchResults,
    detectIntent,
    extractQueryTerms,
    getPath

};
