const LIMITS = {

    MAX_PAGES: 100,

    MAX_DEPTH: 3,

    MAX_LINKS_PER_PAGE: 50,

    CRAWL_DELAY: 1000

};

function sleep(ms) {

    return new Promise(resolve => {

        setTimeout(resolve, ms);

    });

}

module.exports = {

    LIMITS,

    sleep

};