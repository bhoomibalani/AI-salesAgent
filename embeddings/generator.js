const DEFAULT_MODEL = "Xenova/all-MiniLM-L6-v2";

let extractor = null;

async function loadExtractor(model = DEFAULT_MODEL) {

    if (extractor)
        return extractor;

    const { pipeline } = await import("@huggingface/transformers");

    console.log("Loading local transformer model...");
    console.log("(First run downloads the model — this can take a minute.)\n");

    extractor = await pipeline(
        "feature-extraction",
        model
    );

    return extractor;

}

async function embedBatch(texts, options = {}) {

    if (!texts.length)
        return [];

    const model = options.model || DEFAULT_MODEL;

    const pipe = await loadExtractor(model);

    const output = await pipe(texts, {
        pooling: "mean",
        normalize: true
    });

    return output.tolist();

}

async function embedTexts(texts, options = {}) {

    const batchSize = options.batchSize || 16;

    const embeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {

        const batch = texts.slice(i, i + batchSize);

        const batchEmbeddings = await embedBatch(batch, options);

        embeddings.push(...batchEmbeddings);

        if (options.onProgress) {

            options.onProgress(
                Math.min(i + batch.length, texts.length),
                texts.length
            );

        }

    }

    return embeddings;

}

function buildEmbeddingText(chunk) {

    const parts = [];

    if (chunk.title)
        parts.push(`Title: ${chunk.title}`);

    if (chunk.text)
        parts.push(chunk.text);

    return parts.join("\n\n");

}

async function embedChunks(chunks, options = {}) {

    const texts = chunks.map(buildEmbeddingText);

    const vectors = await embedTexts(texts, options);

    const model = options.model || DEFAULT_MODEL;

    return chunks.map((chunk, index) => ({

        id: chunk.id,

        url: chunk.url,

        title: chunk.title || "",

        heading: chunk.heading || "",

        level: chunk.level || "",

        chunkIndex: chunk.chunkIndex,

        text: chunk.text,

        embedding: vectors[index],

        embeddedAt: new Date().toISOString()

    }));

}

module.exports = {

    embedBatch,
    embedTexts,
    embedChunks,
    buildEmbeddingText

};
