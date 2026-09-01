function resolveProvider() {

    const explicit = (process.env.RAG_PROVIDER || "").toLowerCase().trim();

    if (explicit === "gemini" || explicit === "google")
        return "gemini";

    if (explicit === "openai")
        return "openai";

    if (process.env.GEMINI_API_KEY)
        return "gemini";

    const model = (process.env.RAG_MODEL || "").toLowerCase();

    if (model.startsWith("gemini"))
        return "gemini";

    return "openai";

}

module.exports = {

    provider: resolveProvider(),

    model:
        process.env.RAG_MODEL ||
        (resolveProvider() === "gemini" ? "gemini-3.6-flash" : "gpt-4o-mini"),

    // OpenAI (or OpenAI-compatible) only
    apiBase:
        process.env.OPENAI_BASE_URL ||
        "https://api.openai.com/v1",

    // Native Gemini
    geminiBase:
        process.env.GEMINI_BASE_URL ||
        "https://generativelanguage.googleapis.com/v1beta",

    topK: Number(process.env.RAG_TOP_K || 5),

    minSimilarity: Number(process.env.RAG_MIN_SIMILARITY || 0.28),

    temperature: Number(process.env.RAG_TEMPERATURE || 0.2),

    // Gemini 3.x spends part of this budget on thinking — keep headroom
    maxTokens: Number(
        process.env.RAG_MAX_TOKENS ||
        (resolveProvider() === "gemini" ? 2048 : 500)
    ),

    // Gemini thinking: minimal | low | medium | high (3.x) or budget 0 to disable (2.5 Flash)
    thinkingLevel: process.env.RAG_THINKING_LEVEL || "minimal",

    thinkingBudget: process.env.RAG_THINKING_BUDGET !== undefined
        ? Number(process.env.RAG_THINKING_BUDGET)
        : 0

};
