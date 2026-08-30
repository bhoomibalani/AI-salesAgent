const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const { closePool } = require("./db");
const { listWebsites } = require("./repository");

(async () => {

    const sites = await listWebsites();

    if (!sites.length) {

        console.log("No websites in database.");
        console.log("Run: node index.js https://example.com");
        await closePool();
        return;

    }

    console.log("Websites in database:\n");

    for (const site of sites) {

        console.log(`Domain   : ${site.domain}`);
        console.log(`Start URL: ${site.start_url || "(none)"}`);
        console.log(`Pages    : ${site.pages}`);
        console.log(`Chunks   : ${site.chunks} (${site.embedded} embedded)`);
        console.log("");

    }

    await closePool();

})().catch(err => {

    console.error("\nList failed:");
    console.error(err.message);
    process.exit(1);

});
