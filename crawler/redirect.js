function detectRedirect(response) {

    if (!response)
        return null;

    return response.url();

}

module.exports = detectRedirect;