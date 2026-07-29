// Remove duplicate entries


function normalize(text) {

    return text
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();

}

function deduplicateArray(array, field = "text") {

    const seen = new Set();

    return array.filter(item => {

        let value;

        if (typeof item === "string") {

            value = normalize(item);

        }

        else if (typeof item === "object") {

            value = normalize(item[field] || "");

        }

        else {

            return false;

        }

        if (seen.has(value)) {

            return false;

        }

        seen.add(value);

        return true;

    });

}

module.exports = {

    deduplicateArray

};