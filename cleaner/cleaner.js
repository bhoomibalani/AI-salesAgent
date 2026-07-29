// Main orchestrator

const { cleanArray } = require("./boilerplate");
const { deduplicateArray } = require("./deduplicator");
const { validateArray } = require("./validator");

function processField(array, field = "text") {

    let result = cleanArray(array, field);

    result = deduplicateArray(result, field);

    result = validateArray(result, field);

    return result;

}

function cleanPage(page) {

    return {

        ...page,

        headings: processField(page.headings),

        paragraphs: processField(page.paragraphs),

        buttons: processField(page.buttons),

        links: processField(page.links, "text"),

        images: processField(page.images, "alt"),

        tables: page.tables,

        forms: page.forms

    };

}

module.exports = cleanPage;