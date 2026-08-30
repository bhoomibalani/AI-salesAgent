function normalizeDomain(domain = "") {

    return domain
        .trim()
        .toLowerCase()
        .replace(/^www\./, "");

}

function resolveStartUrl(argv = process.argv.slice(2)) {

    const fromArg = argv.find(arg => /^https?:\/\//i.test(arg));

    if (fromArg)
        return fromArg;

    if (process.env.START_URL)
        return process.env.START_URL;

    return null;

}

module.exports = {

    normalizeDomain,
    resolveStartUrl

};
