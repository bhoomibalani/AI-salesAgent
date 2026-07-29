function extractSections(elements = []) {

    const sections = [];

    let currentSection = null;

    for (const element of elements) {

        // New section starts at every heading
        if (element.type === "heading") {

            currentSection = {

                heading: element.text,

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

            case "paragraph":

                currentSection.paragraphs.push(element.text);

                break;

            case "list":

                currentSection.lists.push(element.items);

                break;

            case "table":

                currentSection.tables.push(element.rows);

                break;

            case "button":

                currentSection.buttons.push(element.text);

                break;

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