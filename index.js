const fs = require("fs");
const path = require("path");

const crawlWebsite = require("./crawler/crawler");

(async () => {

    const START_URL = "https://openai.com";

    console.log("--------------------------------");
    console.log("Voice Sales Agent Crawler");
    console.log("--------------------------------");

    console.log("Starting crawl...\n");

    const pages = await crawlWebsite(START_URL);

    const outputDir = path.join(__dirname, "output");

    if (!fs.existsSync(outputDir))
        fs.mkdirSync(outputDir);

    fs.writeFileSync(
        path.join(outputDir, "pages.json"),
        JSON.stringify(pages, null, 2)
    );

    console.log("\n--------------------------------");

    console.log("Crawl Finished");

    console.log("--------------------------------");

    console.log("Pages Crawled :", pages.length);

    console.log(
        "Output File   : output/pages.json"
    );

})();