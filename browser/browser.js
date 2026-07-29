const { chromium } = require("playwright");

async function launchBrowser() {

    const browser = await chromium.launch({
        headless: false
    });

    return browser;
}

module.exports = launchBrowser;