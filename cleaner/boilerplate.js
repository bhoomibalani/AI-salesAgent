 // Remove common website noise

 const NOISE_PATTERNS = [

    /^home$/i,

    /^about$/i,

    /^login$/i,

    /^log in$/i,

    /^sign in$/i,

    /^sign up$/i,

    /^register$/i,

    /^privacy$/i,

    /^privacy policy$/i,

    /^terms$/i,

    /^terms of service$/i,

    /^cookie$/i,

    /^cookie policy$/i,

    /^accept cookies$/i,

    /^manage cookies$/i,

    /^all rights reserved$/i,

    /^linkedin$/i,

    /^facebook$/i,

    /^twitter$/i,

    /^instagram$/i

];

function isNoise(text) {

    if (!text)
        return true;

    const cleaned = text
        .replace(/\s+/g, " ")
        .trim();

    if (cleaned.length === 0)
        return true;

    return NOISE_PATTERNS.some(pattern =>
        pattern.test(cleaned)
    );

}

function cleanArray(array, field = "text") {

    return array.filter(item => {

        if (typeof item === "string") {

            return !isNoise(item);

        }

        if (typeof item === "object") {

            return !isNoise(item[field]);

        }

        return false;

    });

}

module.exports = {

    cleanArray

};