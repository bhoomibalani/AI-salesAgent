const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const parseSearchArgs = require("./parseSearchArgs");
const { closePool } = require("./db");
const { searchSimilar } = require("./repository");
const { embedTexts } = require("../embeddings/generator");

(async () => {

    const { domain, question } = parseSearchArgs();

    if (!question) {

        console.error("Usage: npm run db:search -- [--domain example.com] \"your question\"");
        process.exit(1);

    }

    console.log("Question:", question);

    if (domain)
        console.log("Domain  :", domain);
    else
        console.log("Domain  : all websites");

    console.log("Searching...\n");

    const [queryEmbedding] = await embedTexts([question], {
        batchSize: 1
    });

    const results = await searchSimilar(queryEmbedding, 5, domain, question);

    if (!results.length) {

        console.log("No chunks found in database.");
        console.log("Run: node index.js <url> && npm run embed");
        await closePool();
        return;

    }

    results.forEach((row, index) => {

        console.log(`#${index + 1} similarity=${Number(row.similarity).toFixed(4)}`);
        console.log(`Domain  : ${row.domain}`);
        console.log(`URL     : ${row.url}`);
        console.log(`Heading : ${row.heading}`);
        console.log(`Text    : ${row.text.slice(0, 220)}...\n`);

    });

    await closePool();

})().catch(err => {

    console.error("\nSearch failed:");
    console.error(err.message || err.code || String(err));

    if (err.code === "ECONNREFUSED") {
        console.error("PostgreSQL is not reachable. Start it with: npm run db:up");
    }

    process.exit(1);

});
