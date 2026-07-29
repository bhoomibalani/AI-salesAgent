// Remove invalid/empty content

function isValid(text) {

    if (!text)
        return false;

    const cleaned = text
        .replace(/\s+/g, " ")
        .trim();

    if (cleaned.length < 2)
        return false;

    if (/^[^a-zA-Z0-9]+$/.test(cleaned))
        return false;

    return true;

}

function validateArray(array, field = "text") {

    return array.filter(item => {

        if (typeof item === "string") {

            return isValid(item);

        }

        if (typeof item === "object") {

            return isValid(item[field]);

        }

        return false;

    });

}

module.exports = {

    validateArray

};