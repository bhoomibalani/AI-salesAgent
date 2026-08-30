function parseSearchArgs(argv = process.argv.slice(2)) {

    let domain = process.env.SEARCH_DOMAIN || null;
    const questionParts = [];

    for (let i = 0; i < argv.length; i++) {

        const arg = argv[i];

        if (arg === "--domain" && argv[i + 1]) {

            domain = argv[i + 1];
            i++;
            continue;

        }

        if (arg.startsWith("--domain=")) {

            domain = arg.slice("--domain=".length);
            continue;

        }

        questionParts.push(arg);

    }

    return {
        domain: domain ? domain.replace(/^www\./, "").toLowerCase() : null,
        question: questionParts.join(" ").trim()
    };

}

module.exports = parseSearchArgs;
