// Main orchestrator

const {
    cleanArray,
    isNoise,
    isNavList,
    cleanListItems,
    stripChromeSuffix
} = require("./boilerplate");
const { deduplicateArray } = require("./deduplicator");
const { validateArray } = require("./validator");

function processField(array, field = "text") {

    let result = cleanArray(array, field);

    result = deduplicateArray(result, field);

    result = validateArray(result, field);

    return result;

}

function cleanLists(lists = []) {

    return lists
        .map(cleanListItems)
        .filter(items => items.length && !isNavList(items));

}

function cleanElements(elements = []) {

    const cleaned = [];

    for (const element of elements) {

        if (!element || !element.type)
            continue;

        if (element.type === "heading") {

            const text = stripChromeSuffix(element.text || "");

            if (!text || isNoise(text))
                continue;

            cleaned.push({ ...element, text });
            continue;

        }

        if (element.type === "paragraph") {

            const text = stripChromeSuffix(element.text || "");

            if (!text || isNoise(text) || text.length <= 30)
                continue;

            cleaned.push({ ...element, text });
            continue;

        }

        if (element.type === "list") {

            const items = cleanListItems(element.items || []);

            if (!items.length || isNavList(items))
                continue;

            cleaned.push({ ...element, items });
            continue;

        }

        if (element.type === "button") {

            const text = stripChromeSuffix(element.text || "");

            if (!text || isNoise(text))
                continue;

            cleaned.push({ ...element, text });
            continue;

        }

        if (element.type === "link") {

            const text = stripChromeSuffix(element.text || "");

            if (!text || isNoise(text))
                continue;

            cleaned.push({ ...element, text, href: element.href });
            continue;

        }

        if (element.type === "image") {

            const alt = stripChromeSuffix(element.alt || "");

            if (!alt || isNoise(alt))
                continue;

            cleaned.push({ ...element, alt });
            continue;

        }

        // Keep tables/forms as-is for now
        cleaned.push(element);

    }

    return cleaned;

}

function cleanPage(page) {

    return {

        ...page,

        headings: processField(page.headings || []),

        paragraphs: processField(page.paragraphs || []),

        buttons: processField(page.buttons || []),

        links: processField(page.links || [], "text"),

        images: processField(page.images || [], "alt"),

        lists: cleanLists(page.lists || []),

        tables: page.tables,

        forms: page.forms,

        elements: cleanElements(page.elements || [])

    };

}

module.exports = cleanPage;
