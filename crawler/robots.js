const axios = require("axios");
const robotsParser = require("robots-parser");

class RobotsManager {
    constructor(userAgent = "VoiceSalesCrawler") {
        this.userAgent = userAgent;
        this.robots = null;
        this.sitemaps = [];
        this.crawlDelay = 0;
    }

    async load(startUrl) {
        const robotsUrl = new URL("/robots.txt", startUrl).href;

        try {
            const { data } = await axios.get(robotsUrl, {
                timeout: 5000,
                validateStatus: status => status < 500
            });

            this.robots = robotsParser(robotsUrl, data);

            this.extractExtraInfo(data);
        } catch (err) {
            console.warn(`Couldn't load ${robotsUrl}`);

            // If robots.txt cannot be fetched,
            // allow crawling by default.
            this.robots = null;
        }
    }

    extractExtraInfo(content) {
        this.sitemaps = [];
        this.crawlDelay = 0;

        const lines = content.split(/\r?\n/);

        for (const line of lines) {
            const trimmed = line.trim();

            if (!trimmed || trimmed.startsWith("#"))
                continue;

            const [key, ...rest] = trimmed.split(":");

            const value = rest.join(":").trim();

            switch (key.toLowerCase()) {
                case "sitemap":
                    this.sitemaps.push(value);
                    break;

                case "crawl-delay":
                    this.crawlDelay = Number(value) || 0;
                    break;
            }
        }
    }

    isAllowed(url) {
        if (!this.robots)
            return true;

        return this.robots.isAllowed(
            url,
            this.userAgent
        );
    }

    getSitemaps() {
        return this.sitemaps;
    }

    getCrawlDelay() {
        return this.crawlDelay;
    }
}

module.exports = RobotsManager;
