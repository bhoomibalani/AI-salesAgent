const config = require("./config");
const { buildMessages } = require("./prompt");
const { chatCompletion } = require("./llm");
const { embedTexts } = require("../embeddings/generator");
const { searchSimilar } = require("../database/repository");

async function retrieve(question, options = {}) {

    const domain = options.domain || null;
    const topK = options.topK || config.topK;
    const minSimilarity =
        options.minSimilarity ?? config.minSimilarity;

    const [queryEmbedding] = await embedTexts([question], {
        batchSize: 1
    });

    const rows = await searchSimilar(
        queryEmbedding,
        topK,
        domain,
        question
    );

    const chunks = rows.filter(
        row => Number(row.similarity) >= minSimilarity
    );

    return {
        chunks,
        rawCount: rows.length,
        droppedLowScore: rows.length - chunks.length
    };

}

async function answerQuestion(question, options = {}) {

    if (!question || !String(question).trim()) {

        throw new Error("Question is required");

    }

    const retrieval = await retrieve(question, options);
    const { chunks } = retrieval;

    if (!chunks.length) {

        return {
            answer: "I couldn't find that information on the website.",
            chunks: [],
            model: null,
            usage: null,
            retrieval
        };

    }

    const messages = buildMessages(question, chunks);
    const llm = await chatCompletion(messages, options);

    return {
        answer: llm.answer,
        chunks,
        model: llm.model,
        usage: llm.usage,
        retrieval
    };

}

module.exports = {

    retrieve,
    answerQuestion

};
