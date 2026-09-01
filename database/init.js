const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const { initSchema, closePool } = require("./db");
const { countStats } = require("./repository");

(async () => {

    console.log("--------------------------------");
    console.log("Database Init (websites → pages → chunks)");
    console.log("--------------------------------");

    await initSchema();

    const stats = await countStats();

    console.log("Schema applied successfully.");
    console.log("");
    console.log("websites :", stats.websites);
    console.log("pages    :", stats.pages);
    console.log("chunks   :", stats.chunks);

    await closePool();

})().catch(err => {

    console.error("\nDatabase init failed:");
    console.error(err.message);
    process.exit(1);

});
