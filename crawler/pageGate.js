function isChallengePage(pageData = {}) {

    const title = String(pageData.metadata?.title || pageData.title || "").toLowerCase();
    const body = String(pageData.bodyText || "").toLowerCase();
    const paragraphs = (pageData.paragraphs || []).join(" ").toLowerCase();
    const text = `${title}\n${body}\n${paragraphs}`;

    if (/just a moment|attention required|access denied|verify you are human|checking your browser|enable javascript and cookies|cf-browser-verification|security check/i.test(text))
        return true;

    if (/cloudflare/i.test(title) && /moment|verify|checking/i.test(text))
        return true;

    return false;

}

function isEmptyContent(pageData = {}) {

    const headings = pageData.headings?.length || 0;
    const paragraphs = pageData.paragraphs?.length || 0;
    const lists = pageData.lists?.length || 0;
    const tables = pageData.tables?.length || 0;

    return headings === 0 && paragraphs === 0 && lists === 0 && tables === 0;

}

module.exports = {
    isChallengePage,
    isEmptyContent
};
