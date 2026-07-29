function normalizeUrl(url) {

    try {

        const parsed = new URL(url);

        // Convert hostname to lowercase
        parsed.hostname = parsed.hostname.toLowerCase();

        // Remove fragment (#section)
        parsed.hash = "";

        // Remove tracking query parameters
        const trackingParams = [
            "utm_source",
            "utm_medium",
            "utm_campaign",
            "utm_term",
            "utm_content",
            "fbclid",
            "gclid"
        ];

        trackingParams.forEach(param => {
            parsed.searchParams.delete(param);
        });

        // If no query params remain, remove '?'
        if ([...parsed.searchParams.keys()].length === 0) {
            parsed.search = "";
        }

        // Remove trailing slash except root
        if (
            parsed.pathname.length > 1 &&
            parsed.pathname.endsWith("/")
        ) {
            parsed.pathname = parsed.pathname.slice(0, -1);
        }

        return parsed.toString();

    } catch (error) {

        return null;

    }
}

module.exports = normalizeUrl;