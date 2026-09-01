const { isNoise, isNavList, cleanListItems, stripChromeSuffix } = require("../cleaner/boilerplate");

function extractSections(elements = []) {

    const sections = [];

    let currentSection = null;

    for (const element of elements) {

        // New section starts at every heading
        if (element.type === "heading") {

            const heading = stripChromeSuffix(element.text || "");

            if (!heading || isNoise(heading))
                continue;

            currentSection = {

                heading,

                level: element.level,

                paragraphs: [],

                lists: [],

                tables: [],

                buttons: []

            };

            sections.push(currentSection);

            continue;

        }

        // Ignore content before the first heading
        if (!currentSection) continue;

        switch (element.type) {

            case "paragraph": {

                const text = stripChromeSuffix(element.text || "");

                if (text && !isNoise(text))
                    currentSection.paragraphs.push(text);

                break;

            }

            case "list": {

                const items = cleanListItems(element.items || []);

                if (items.length && !isNavList(items))
                    currentSection.lists.push(items);

                break;

            }

            case "table":

                currentSection.tables.push(element.rows);

                break;

            case "button": {

                const text = stripChromeSuffix(element.text || "");

                if (text && !isNoise(text))
                    currentSection.buttons.push(text);

                break;

            }

            default:

                break;

        }

    }

    // Remove empty sections
    return sections.filter(section =>

        section.paragraphs.length ||

        section.lists.length ||

        section.tables.length ||

        section.buttons.length

    );

}

module.exports = extractSections;