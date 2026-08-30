// Generic sales / product paths tried on any website (404s are skipped)

const SALES_PATHS = [
    // Offerings
    "/products",
    "/product",
    "/platform",
    "/payments",
    "/billing",
    "/features",
    "/solutions",
    "/services",
    "/enterprise",
    "/business",
    "/connect",
    "/academy",
    // Pricing & plans
    "/pricing",
    "/plans",
    "/pricing/connect",
    "/pricing/academy",
    "/business/pricing",
    // Sales motion
    "/contact",
    "/contact-sales",
    "/demo",
    "/talk-to-sales",
    // Common FAQ / about
    "/faq",
    "/about",
    "/company",
    "/whatsapp",
    "/crm",
    "/pricing/connect",
    "/connect/pricing"
];

function getSalesSeedUrls(startUrl) {

    const origin = new URL(startUrl).origin;

    return SALES_PATHS.map(path => `${origin}${path}`);

}

module.exports = {

    SALES_PATHS,
    getSalesSeedUrls

};
