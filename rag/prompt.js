const SYSTEM_PROMPT = `You are a helpful sales assistant answering questions about the company using only the website context provided.

Rules:
1. Do not invent information.
2. Do not use knowledge outside the provided context.
3. If the answer is not available in the context, clearly say:
   "I couldn't find that information on the website."
4. Give a natural, helpful, conversational answer.
5. Do not mention embeddings, chunks, vector databases, retrieval, or the internal system.`;

function formatContext(chunks = []) {

    if (!chunks.length)
        return "(No website excerpts available.)";

    return chunks.map((chunk, index) => {

        const parts = [
            `[Excerpt ${index + 1}]`,
            chunk.url ? `Page: ${chunk.url}` : null,
            chunk.heading ? `Section: ${chunk.heading}` : null,
            "",
            chunk.text || ""
        ].filter(Boolean);

        return parts.join("\n");

    }).join("\n\n---\n\n");

}

function buildMessages(question, chunks) {

    const context = formatContext(chunks);

    const userPrompt = [
        "Website context:",
        context,
        "",
        "Customer question:",
        question,
        "",
        "Your reply:"
    ].join("\n");

    return [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
    ];

}

module.exports = {

    SYSTEM_PROMPT,
    formatContext,
    buildMessages

};
