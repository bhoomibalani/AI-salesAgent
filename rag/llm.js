const axios = require("axios");
const config = require("./config");

function extractApiError(err) {

    const data = err.response?.data;

    if (!data)
        return err.message || String(err);

    if (typeof data === "string")
        return data;

    return (
        data.error?.message ||
        data.message ||
        JSON.stringify(data)
    );

}

function splitMessages(messages = []) {

    const systemParts = [];
    const contents = [];

    for (const message of messages) {

        const text = String(message.content || "").trim();

        if (!text)
            continue;

        if (message.role === "system") {

            systemParts.push(text);
            continue;

        }

        contents.push({
            role: message.role === "assistant" ? "model" : "user",
            parts: [{ text }]
        });

    }

    return {
        systemInstruction: systemParts.length
            ? { parts: [{ text: systemParts.join("\n\n") }] }
            : null,
        contents
    };

}

async function chatGemini(messages, options = {}) {

    const apiKey =
        process.env.GEMINI_API_KEY ||
        process.env.OPENAI_API_KEY;

    if (!apiKey) {

        throw new Error(
            "Missing GEMINI_API_KEY in .env (needed for Gemini answers)"
        );

    }

    const model = (options.model || config.model).replace(/^models\//, "");
    const temperature = options.temperature ?? config.temperature;
    const maxTokens = options.maxTokens || config.maxTokens;
    const base = (options.geminiBase || config.geminiBase).replace(/\/$/, "");

    const { systemInstruction, contents } = splitMessages(messages);

    if (!contents.length) {

        throw new Error("No user message provided for Gemini");

    }

    const body = {
        contents,
        generationConfig: {
            temperature,
            maxOutputTokens: maxTokens
        }
    };

    // Gemini 3.x / 2.5: thinking tokens count against maxOutputTokens
    // and can truncate the visible answer mid-sentence.
    const thinkingLevel = options.thinkingLevel || config.thinkingLevel;
    const thinkingBudget =
        options.thinkingBudget !== undefined
            ? options.thinkingBudget
            : config.thinkingBudget;

    if (model.includes("gemini-3")) {

        body.generationConfig.thinkingConfig = {
            thinkingLevel: thinkingLevel || "minimal"
        };

    } else if (model.includes("gemini-2.5") || model.includes("gemini-2.0")) {

        body.generationConfig.thinkingConfig = {
            thinkingBudget:
                Number.isFinite(thinkingBudget) ? thinkingBudget : 0
        };

    }

    if (systemInstruction)
        body.systemInstruction = systemInstruction;

    const url = `${base}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await axios.post(url, body, {
        headers: { "Content-Type": "application/json" },
        timeout: 60000
    });

    const candidate = response.data?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // Skip internal thought parts if the API returns them
    const content = parts
        .filter(part => !part.thought)
        .map(part => part.text || "")
        .join("")
        .trim();

    if (!content) {

        const block = response.data?.promptFeedback?.blockReason;
        const finish = candidate?.finishReason;
        throw new Error(
            block
                ? `Gemini blocked the response (${block})`
                : finish === "MAX_TOKENS"
                    ? "Gemini ran out of output tokens while thinking. Increase RAG_MAX_TOKENS or set RAG_THINKING_LEVEL=minimal."
                    : "Gemini returned an empty response"
        );

    }

    if (candidate?.finishReason === "MAX_TOKENS") {

        console.warn(
            "Warning: Gemini answer may be truncated (MAX_TOKENS). " +
            "Increase RAG_MAX_TOKENS if needed."
        );

    }

    const usageMeta = response.data?.usageMetadata || null;

    return {
        answer: content,
        model,
        usage: usageMeta
            ? {
                prompt_tokens: usageMeta.promptTokenCount,
                completion_tokens: usageMeta.candidatesTokenCount,
                total_tokens: usageMeta.totalTokenCount
            }
            : null
    };

}

async function chatOpenAI(messages, options = {}) {

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {

        throw new Error(
            "Missing OPENAI_API_KEY in .env (needed for OpenAI answers)"
        );

    }

    const model = options.model || config.model;
    const temperature = options.temperature ?? config.temperature;
    const maxTokens = options.maxTokens || config.maxTokens;
    const base = (options.apiBase || config.apiBase).replace(/\/$/, "");

    const response = await axios.post(
        `${base}/chat/completions`,
        {
            model,
            messages,
            temperature,
            max_tokens: maxTokens
        },
        {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            timeout: 60000
        }
    );

    const content = response.data?.choices?.[0]?.message?.content;

    if (!content) {

        throw new Error("LLM returned an empty response");

    }

    return {
        answer: content.trim(),
        model,
        usage: response.data?.usage || null
    };

}

async function chatCompletion(messages, options = {}) {

    const provider = (options.provider || config.provider || "openai").toLowerCase();

    try {

        if (provider === "gemini" || provider === "google")
            return await chatGemini(messages, options);

        return await chatOpenAI(messages, options);

    } catch (err) {

        err.message = extractApiError(err);
        throw err;

    }

}

module.exports = {

    chatCompletion,
    chatGemini,
    chatOpenAI

};
