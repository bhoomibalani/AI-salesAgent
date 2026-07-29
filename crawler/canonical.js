async function getCanonical(page) {

    try {

        const href = await page.$eval(

            'link[rel="canonical"]',

            el => el.href

        );

        return href;

    }

    catch {

        return null;

    }

}

module.exports = getCanonical;