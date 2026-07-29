const fs = require("fs");

function savePages(pages) {

    fs.writeFileSync(
        "./output/pages.json",
        JSON.stringify(pages, null, 4)
    );

}

module.exports = savePages;