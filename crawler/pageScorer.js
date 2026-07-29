function score(url) {

    const path = new URL(url)
        .pathname
        .toLowerCase();

    const priorities = {

        pricing: 100,

        product: 95,

        products: 95,

        features: 90,

        feature: 90,

        demo: 85,

        docs: 80,

        faq: 80,

        contact: 70,

        support: 65,

        blog: 20,

        privacy: 5,

        terms: 5,

        cookies: 1

    };

    let maxScore = 50;

    for (const keyword in priorities) {

        if (path.includes(keyword)) {

            maxScore = Math.max(
                maxScore,
                priorities[keyword]
            );

        }

    }

    return maxScore;

}

module.exports = score;