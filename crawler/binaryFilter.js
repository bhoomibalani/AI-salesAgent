const EXTENSIONS = [

    ".pdf",
    ".zip",
    ".rar",
    ".7z",

    ".doc",
    ".docx",

    ".xls",
    ".xlsx",

    ".ppt",
    ".pptx",

    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",

    ".mp4",
    ".mp3",
    ".avi",
    ".mov",

    ".exe",
    ".apk"

];

function isBinary(url) {

    const path = new URL(url)
        .pathname
        .toLowerCase();

    return EXTENSIONS.some(ext =>
        path.endsWith(ext)
    );

}

module.exports = isBinary;