 // Remove common website noise

 const NOISE_PATTERNS = [

    /^home$/i,
    /^about$/i,
    /^about us$/i,
    /^login$/i,
    /^log in$/i,
    /^sign in$/i,
    /^sign up$/i,
    /^register$/i,
    /^try openai$/i,
    /^more$/i,
    /^menu$/i,
    /^close$/i,
    /^search$/i,
    /^privacy$/i,
    /^privacy policy$/i,
    /^terms$/i,
    /^terms of (service|use)$/i,
    /^other policies$/i,
    /^cookie$/i,
    /^cookie policy$/i,
    /^accept cookies$/i,
    /^manage cookies$/i,
    /^all rights reserved$/i,
    /^english( united states)?$/i,
    /^linkedin$/i,
    /^facebook$/i,
    /^twitter$/i,
    /^instagram$/i,
    /^youtube$/i,
    /^rss$/i,
    /^research$/i,
    /^research index$/i,
    /^research overview$/i,
    /^products?$/i,
    /^business$/i,
    /^developers?$/i,
    /^company$/i,
    /^foundation$/i,
    /^solutions?$/i,
    /^resources?$/i,
    /^customers?$/i,
    /^pricing$/i,
    /^why openai$/i,
    /^contact sales$/i,
    /^partner network$/i,
    /^customer stories$/i,
    /^help center$/i,
    /^support$/i,
    /^support plans?\.?$/i,
    /^24\s*x?\s*7 support$/i,
    /^help$/i,
    /^documentation$/i,
    /^careers$/i,
    /^news$/i,
    /^docs$/i,
    /^overview$/i,
    /^api log in$/i,
    /^release notes$/i,
    /^our charter$/i,
    /^safety approach$/i,
    /^security & privacy$/i,
    /^trust & transparency$/i,
    /^economic research$/i,
    /^deployment safety$/i,
    /^open models$/i,
    /^developer forum$/i,
    /^apps sdk$/i,
    /^supply co\.?$/i,
    /^livestreams$/i,
    /^podcast$/i,
    /^stories$/i,
    /^academy$/i,
    /^filter$/i,
    /^sort$/i,
    /^load more$/i,
    /^copy rss feed url$/i,
    /^all$/i,
    /^chatgpt$/i,
    /^chatgpt business$/i,
    /^chatgpt enterprise$/i,
    /^chatgpt for education$/i,
    /^codex$/i,
    /^api$/i,
    /^gpt-?\d+(\.\d+)?$/i,
    /^reject( all| non-essential)?$/i,
    /^accept all$/i,
    /^necessary only$/i,
    /^view all$/i,
    /^share$/i,
    /^start building$/i,
    /^navigate to:?$/i,
    /^skip to (content|main)$/i,
    /^ready to launch\b/i,
    /^integrations?\b/i,
    /^integrations? & custom solutions$/i,
    /^cart(\s*\(\d+\))?$/i,
    /\(opens in a new window\)\s*$/i

];

const COOKIE_BANNER_PATTERNS = [

    /^we use cookies\b/i,
    /visit manage cookies to change preferences/i,
    /view our cookie policy/i,
    /reject non-essential/i

];

function stripChromeSuffix(text) {

    return text
        .replace(/\s*\(opens in a new window\)\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim();

}

function isNoise(text) {

    if (!text)
        return true;

    const cleaned = stripChromeSuffix(text);

    if (cleaned.length === 0)
        return true;

    if (NOISE_PATTERNS.some(pattern => pattern.test(cleaned)))
        return true;

    return COOKIE_BANNER_PATTERNS.some(pattern =>
        pattern.test(cleaned)
    );

}

function isNavList(items = []) {

    if (!items.length)
        return true;

    const normalized = items
        .map(item => stripChromeSuffix(String(item || "")))
        .filter(Boolean);

    if (!normalized.length)
        return true;

    const shortRatio =
        normalized.filter(item => item.length < 50).length /
        normalized.length;

    const noiseHits = normalized.filter(isNoise).length;
    const noiseRatio = noiseHits / normalized.length;

    const opensHits = items.filter(item =>
        /\(opens in a new window\)/i.test(String(item || ""))
    ).length;

    // Footer / mega-menu chrome
    if (opensHits >= 3)
        return true;

    // Mostly short labels that match nav chrome
    if (normalized.length >= 5 && shortRatio >= 0.8 && noiseRatio >= 0.4)
        return true;

    // Large short-label dumps are almost always nav/footer
    if (normalized.length > 12 && shortRatio >= 0.85)
        return true;

    // Entire list is chrome labels
    if (noiseRatio >= 0.7)
        return true;

    // Short label rows (mega-menu leftovers), not feature bullets
    const veryShort =
        normalized.filter(item => item.length < 28).length /
        normalized.length;

    if (normalized.length >= 4 && veryShort >= 0.75)
        return true;

    return false;

}

function cleanListItems(items = []) {

    const cleaned = [];
    const seen = new Set();

    for (const item of items) {

        const text = stripChromeSuffix(String(item || ""));

        if (!text || isNoise(text))
            continue;

        const key = text.toLowerCase();

        if (seen.has(key))
            continue;

        seen.add(key);
        cleaned.push(text);

    }

    return cleaned;

}

function cleanArray(array, field = "text") {

    return array.filter(item => {

        if (typeof item === "string") {

            return !isNoise(item);

        }

        if (typeof item === "object") {

            return !isNoise(item[field]);

        }

        return false;

    });

}

module.exports = {

    cleanArray,
    isNoise,
    isNavList,
    cleanListItems,
    stripChromeSuffix

};
