const fs = require("fs");
const path = require("path");

const chunkPage = require("./chunker");
const extractSections = require("../extractor/sectionExtractor");

// Read crawled pages
const pages = JSON.parse(
    fs.readFileSync(
        path.join(__dirname, "../output/pages.json"),
        "utf8"
    )
);

const allChunks = [];

for (const page of pages) {

    // Build semantic sections from extracted DOM elements
    page.sections = extractSections(page.elements);

    // Convert sections into chunks
    const chunks = chunkPage(page);

    allChunks.push(...chunks);

}

fs.writeFileSync(
    path.join(__dirname, "../output/chunks.json"),
    JSON.stringify(allChunks, null, 2)
);

console.log("Pages :", pages.length);
console.log("Chunks:", allChunks.length);

if (allChunks.length > 0) {

    console.log("\nSample Chunk:\n");

    console.log(allChunks[0]);

}