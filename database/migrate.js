const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const { migrateSchema, closePool } = require("./db");

(async () => {

    console.log("Applying database migrations...");
    await migrateSchema();
    console.log("Migration complete.");

    await closePool();

})().catch(err => {

    console.error("\nMigration failed:");
    console.error(err.message);
    process.exit(1);

});
