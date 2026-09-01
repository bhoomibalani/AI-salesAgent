function addOverlap(chunks, overlapParagraphs = 1) {

    if (!Array.isArray(chunks) || chunks.length <= 1)
        return chunks;

    const count = Math.max(0, overlapParagraphs);

    const result = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {

        const previous = chunks[i - 1];
        const current = chunks[i];

        const overlap = previous.slice(-count);

        result.push([...overlap, ...current]);

    }

    return result;

}

module.exports = addOverlap;
