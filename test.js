const RobotsParser = require("./crawler/robots");

(async () => {

    const robots = new RobotsParser();

   await robots.load("https://openai.com");

    console.log(

        robots.getRules()

    );

    console.log(

        robots.getSitemaps()

    );

    console.log(

        robots.getCrawlDelay()

    );

    console.log(

        robots.isAllowed(

            "https://example.com/admin"

        )

    );

})();