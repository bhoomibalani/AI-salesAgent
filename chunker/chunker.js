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

    if (!page.sections || page.sections.length === 0) {

        return chunks;

    }

    for (const section of page.sections) {

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

            // Lists
            if (section.lists && section.lists.length) {

                content.push("\nLists:");

                section.lists.forEach(list => {

                    list.forEach(item => {

                        content.push(`• ${item}`);

                    });

                });

            }

            // Tables
            if (section.tables && section.tables.length) {

                content.push("\nTables:");

                content.push(formatTables(section.tables));

            }

            // Buttons
            if (section.buttons && section.buttons.length) {

                content.push("\nButtons:");

                section.buttons.forEach(button => {

                    content.push(`Button: ${button}`);

                });

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