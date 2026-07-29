  // Internal link filtering

  function getInternalLinks(links, startUrl) {

    const origin = new URL(startUrl).origin;

    const internalLinks = links.filter(link => {

        try {
            return new URL(link).origin === origin;
        }
        catch {
            return false;
        }

    });

    return [...new Set(internalLinks)];
}

module.exports = getInternalLinks;