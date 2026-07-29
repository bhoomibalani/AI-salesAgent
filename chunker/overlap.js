function addOverlap(chunks, overlapChars = 150) {

    if (chunks.length <= 1)
        return chunks;

    const result = [chunks[0]];

    for (let i = 1; i < chunks.length; i++) {

        const previous = chunks[i - 1];
        const current = chunks[i];

        const overlap = previous.slice(-overlapChars);

        result.push(overlap + "\n\n" + current);

    }

    return result;

}

module.exports = addOverlap;