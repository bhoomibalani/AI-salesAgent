const { answerQuestion, retrieve } = require("./ragAgent");
const config = require("./config");

/**
 * Sales RAG — ask a question against crawled website chunks.
 *
 * @param {string} question
 * @param {{ domain?: string, topK?: number, minSimilarity?: number }} [options]
 * @returns {Promise<{
 *   question: string,
 *   domain: string|null,
 *   answer: string,
 *   model: string|null,
 *   provider: string,
 *   usage: object|null,
 *   elapsedMs: number,
 *   sources: Array<{url: string, heading: string, domain?: string, similarity: number, excerpt: string}>
 * }>}
 */
async function ask(question, options = {}) {

    const text = String(question || "").trim();

    if (!text)
        throw new Error("Question is required");

    const domain = options.domain
        ? String(options.domain).replace(/^www\./, "").toLowerCase()
        : null;

    const startedAt = Date.now();

    const result = await answerQuestion(text, {
        domain,
        topK: options.topK,
        minSimilarity: options.minSimilarity
    });

    return {
        question: text,
        domain,
        answer: result.answer,
        model: result.model,
        provider: config.provider,
        usage: result.usage,
        elapsedMs: Date.now() - startedAt,
        sources: (result.chunks || []).map(chunk => ({
            url: chunk.url,
            heading: chunk.heading || "",
            domain: chunk.domain,
            similarity: Number(chunk.similarity || 0),
            excerpt: String(chunk.text || "").slice(0, 280)
        }))
    };

}

module.exports = {
    ask,
    answerQuestion,
    retrieve
};
