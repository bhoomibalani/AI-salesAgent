const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const parseSearchArgs = require("../database/parseSearchArgs");
const { closePool } = require("../database/db");
const { answerQuestion } = require("./ragAgent");
const config = require("./config");

(async () => {

    const { domain, question } = parseSearchArgs();

    if (!question) {

        console.error("Usage: npm run ask -- [--domain example.com] \"your question\"");
        console.error("Example: npm run ask -- --domain stripe.com \"What services do you offer?\"");
        process.exit(1);

    }

    console.log("--------------------------------");
    console.log("Sales RAG Agent");
    console.log("--------------------------------");
    console.log("Question :", question);
    console.log("Domain   :", domain || "all websites");
    console.log("Provider :", config.provider);
    console.log("Model    :", config.model);
    console.log("");
    console.log("Thinking...\n");

    const result = await answerQuestion(question, { domain });

    if (result.chunks.length) {

        console.log("Based on:");

        result.chunks.forEach((chunk, index) => {

            console.log(`  ${index + 1}. ${chunk.url}`);
            if (chunk.heading)
                console.log(`     ${chunk.heading}`);

        });

        console.log("");

    }

    console.log("Answer:");
    console.log(result.answer);
    console.log("");

    if (result.model)
        console.log("LLM:", result.model);

    if (result.usage) {

        console.log(
            "Tokens:",
            `prompt=${result.usage.prompt_tokens}`,
            `completion=${result.usage.completion_tokens}`
        );

    }

    await closePool();

})().catch(async err => {

    console.error("\nRAG ask failed:");
    console.error(err.message || err.code || String(err));

    if (err.code === "ECONNREFUSED") {
        console.error("PostgreSQL is not reachable. Start it with: npm run db:up");
    }

    if (err.response?.status) {
        const data = err.response.data;
        const detail =
            data?.error?.message ||
            data?.message ||
            (typeof data === "string" ? data : JSON.stringify(data || {}));
        console.error("LLM API status:", err.response.status, detail);
    }

    try {
        await closePool();
    } catch (_) {}

    process.exit(1);

});
