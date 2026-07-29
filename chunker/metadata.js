function attachMetadata(page, section, text, chunkIndex) {

    return {

        id: `${page.url}#${chunkIndex}`,

        url: page.url,

        title: page.metadata.title,

        heading: section.heading,

        level: section.level,

        chunkIndex,

        text,

        createdAt: new Date().toISOString()

    };

}

module.exports = attachMetadata;