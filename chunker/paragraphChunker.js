function countWords(text) {

    return text
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .length;

}

function splitParagraphs(paragraphs, maxWords = 180) {

    const chunks = [];

    let currentChunk = [];

    let currentWords = 0;

    for (const paragraph of paragraphs) {

        const words = countWords(paragraph);

        if (

            currentWords + words > maxWords &&

            currentChunk.length > 0

        ) {

            chunks.push(currentChunk);

            currentChunk = [];

            currentWords = 0;

        }

        currentChunk.push(paragraph);

        currentWords += words;

    }

    if (currentChunk.length) {

        chunks.push(currentChunk);

    }

    return chunks;

}

module.exports = splitParagraphs;