const splitParagraphs = require("./paragraphChunker");
const addOverlap = require("./overlap");

function formatTables(tables = []) {

    return tables
        .map(table =>
            table
                .map(row => row.join(" | "))
                .join("\n")
        )
        .join("\n\n");

}

function chunkPage(page) {

    const chunks = [];

    let sections = page.sections || [];

    // SPA pages (e.g. pricing cards) may have paragraphs but no sections
    if (!sections.length) {

        const paragraphs = (page.paragraphs || []).filter(Boolean);

        if (!paragraphs.length)
            return chunks;

        sections = [{
            heading: page.metadata?.title || "Overview",
            level: "H1",
            paragraphs,
            lists: page.lists || [],
            tables: page.tables || [],
            buttons: (page.buttons || []).map(b => b.text || b).filter(Boolean)
        }];

    }

    for (const section of sections) {

        const paragraphChunks = splitParagraphs(

            section.paragraphs || [],

            180

        );

        const finalChunks = addOverlap(

            paragraphChunks,

            1

        );

        finalChunks.forEach((paragraphs, index) => {

            const content = [];

            // Heading
            if (section.heading) {

                content.push(`Heading: ${section.heading}`);

            }

            // Paragraphs
            content.push(...paragraphs);

            // Attach lists/tables/buttons only once per section
            // so nav leftovers are not repeated across overlap chunks
            if (index === 0) {

                if (section.lists && section.lists.length) {

                    content.push("\nLists:");

                    section.lists.forEach(list => {

                        list.forEach(item => {

                            content.push(`• ${item}`);

                        });

                    });

                }

                if (section.tables && section.tables.length) {

                    content.push("\nTables:");

                    content.push(formatTables(section.tables));

                }

                if (section.buttons && section.buttons.length) {

                    content.push("\nButtons:");

                    section.buttons.forEach(button => {

                        content.push(`Button: ${button}`);

                    });

                }

            }

            chunks.push({

                id: `${page.url}#${chunks.length}`,

                url: page.url,

                title: page.metadata?.title || "",

                heading: section.heading,

                level: section.level,

                chunkIndex: chunks.length,

                text: content.join("\n\n"),

                createdAt: new Date().toISOString()

            });

        });

    }

    return chunks;

}

module.exports = chunkPage;