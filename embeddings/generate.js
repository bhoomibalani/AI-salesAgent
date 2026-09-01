require("dotenv").config({
    path: require("path").join(__dirname, "..", ".env")
});

const config = require("./config");
const { embedChunks } = require("./generator");
const { closePool } = require("../database/db");
const {
    getChunksWithoutEmbeddings,
    updateChunkEmbeddings,
    countStats,
    listWebsites
} = require("../database/repository");

function parseDomainArg() {

    const argv = process.argv.slice(2);

    if (argv[0] === "--domain" && argv[1])
        return argv[1].replace(/^www\./, "").toLowerCase();

    if (argv[0]?.startsWith("--domain="))
        return argv[0].slice("--domain=".length).replace(/^www\./, "").toLowerCase();

    // npm sometimes drops --domain: `npm run embed -- stripe.com`
    if (argv[0] && !argv[0].startsWith("-") && argv[0].includes("."))
        return argv[0].replace(/^www\./, "").toLowerCase();

    return process.env.EMBED_DOMAIN || null;

}

(async () => {

    const domain = parseDomainArg();
    const chunks = await getChunksWithoutEmbeddings(domain);

    if (!chunks.length) {

        const stats = await countStats();

        console.log("No chunks waiting for embeddings.");

        if (domain)
            console.log(`Domain filter: ${domain}`);

        console.log(`DB already has ${stats.embedded}/${stats.chunks} chunks embedded.`);
        await closePool();
        return;

    }

    console.log("--------------------------------");
    console.log("Embedding Generator (local HF model)");
    console.log("--------------------------------");
    console.log("Model     :", config.model);
    console.log("Backend   : @huggingface/transformers");
    console.log("Source    : PostgreSQL");

    if (domain)
        console.log("Domain    :", domain);
    else
        console.log("Domain    : all websites");

    console.log("Chunks    :", chunks.length);
    console.log("Batch size:", config.batchSize);
    console.log("");

    const startedAt = Date.now();

    const items = await embedChunks(chunks, {

        model: config.model,

        batchSize: config.batchSize,

        onProgress(done, total) {

            console.log(`Embedded ${done}/${total}`);

        }

    });

    console.log("");
    console.log("Updating PostgreSQL...");

    await updateChunkEmbeddings(items, config.model);

    const stats = await countStats();
    const sites = await listWebsites();

    await closePool();

    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log("");
    console.log("--------------------------------");
    console.log("Embeddings Saved to PostgreSQL");
    console.log("--------------------------------");
    console.log("Embedded now:", items.length);
    console.log("Dimensions  :", items[0]?.embedding?.length || 384);
    console.log("DB websites :", stats.websites);
    console.log("DB pages    :", stats.pages);
    console.log("DB chunks   :", stats.chunks);
    console.log("DB embedded :", stats.embedded);
    console.log("Elapsed     :", `${elapsed}s`);
    console.log("");
    console.log("Per website:");

    for (const site of sites) {

        console.log(
            `  - ${site.domain}: ${site.chunks} chunks (${site.embedded} embedded)`
        );

    }

})().catch(async err => {

    console.error("\nEmbedding generation failed:");
    console.error(err.message || err.code || String(err));

    if (err.code === "ECONNREFUSED") {
        console.error("PostgreSQL is not reachable. Start it with: npm run db:up");
    }

    try {
        await closePool();
    } catch (_) {}

    process.exit(1);

});
