async function extractPage(page) {

    return await page.evaluate(() => {

        const clean = text =>
            text?.replace(/\s+/g, " ").trim() || "";

        /* ---------------- Metadata ---------------- */

        const metadata = {

            title: document.title,

            description:
                document.querySelector('meta[name="description"]')
                    ?.content || "",

            keywords:
                document.querySelector('meta[name="keywords"]')
                    ?.content || "",

            author:
                document.querySelector('meta[name="author"]')
                    ?.content || "",

            canonical:
                document.querySelector("link[rel='canonical']")
                    ?.href || "",

            language:
                document.documentElement.lang || ""

        };

        /* ---------------- Collections ---------------- */

        const headings = [];
        const paragraphs = [];
        const lists = [];
        const buttons = [];
        const links = [];
        const images = [];
        const tables = [];
        const forms = [];

        // NEW (ordered DOM for semantic processing)
        const elements = [];

        /* ---------------- Headings ---------------- */

        document
            .querySelectorAll("h1,h2,h3,h4,h5,h6")
            .forEach(h => {

                const text = clean(h.innerText);

                if (!text) return;

                const data = {

                    level: h.tagName,

                    text

                };

                headings.push(data);

                elements.push({

                    type: "heading",

                    ...data

                });

            });

        /* ---------------- Paragraphs ---------------- */

        document
            .querySelectorAll("p")
            .forEach(p => {

                const text = clean(p.innerText);

                if (text.length <= 30) return;

                paragraphs.push(text);

                elements.push({

                    type: "paragraph",

                    text

                });

            });

        /* ---------------- Lists ---------------- */

        document
            .querySelectorAll("ul,ol")
            .forEach(list => {

                const items = [];

                list
                    .querySelectorAll(":scope > li")
                    .forEach(li => {

                        const text = clean(li.innerText);

                        if (text)
                            items.push(text);

                    });

                if (!items.length) return;

                lists.push(items);

                elements.push({

                    type: "list",

                    items

                });

            });

        /* ---------------- Buttons ---------------- */

        document
            .querySelectorAll(
                "button,input[type='button'],input[type='submit']"
            )
            .forEach(button => {

                const data = {

                    text:
                        clean(button.innerText) ||
                        clean(button.value),

                    type:
                        button.type || "button"

                };

                buttons.push(data);

                elements.push({

                    type: "button",

                    ...data

                });

            });

        /* ---------------- Links ---------------- */

        document
            .querySelectorAll("a[href]")
            .forEach(link => {

                const data = {

                    text: clean(link.innerText),

                    href: link.href

                };

                links.push(data);

                elements.push({

                    type: "link",

                    ...data

                });

            });

        /* ---------------- Images ---------------- */

        document
            .querySelectorAll("img")
            .forEach(img => {

                const data = {

                    src: img.src,

                    alt: clean(img.alt),

                    width: img.width,

                    height: img.height

                };

                images.push(data);

                elements.push({

                    type: "image",

                    ...data

                });

            });

        /* ---------------- Tables ---------------- */

        document
            .querySelectorAll("table")
            .forEach(table => {

                const rows = [];

                table
                    .querySelectorAll("tr")
                    .forEach(tr => {

                        const cols = [];

                        tr.querySelectorAll("th,td")
                            .forEach(cell => {

                                cols.push(clean(cell.innerText));

                            });

                        rows.push(cols);

                    });

                tables.push(rows);

                elements.push({

                    type: "table",

                    rows

                });

            });

        /* ---------------- Forms ---------------- */

        document
            .querySelectorAll("form")
            .forEach(form => {

                const fields = [];

                form
                    .querySelectorAll("input,textarea,select")
                    .forEach(field => {

                        fields.push({

                            name: field.name,

                            type:
                                field.type ||
                                field.tagName,

                            placeholder:
                                field.placeholder || ""

                        });

                    });

                const data = {

                    action: form.action,

                    method:
                        form.method || "GET",

                    fields

                };

                forms.push(data);

                elements.push({

                    type: "form",

                    ...data

                });

            });

        return {

            url: location.href,

            metadata,

            headings,

            paragraphs,

            buttons,

            links,

            images,

            tables,

            forms,

            lists,

            elements

        };

    });

}

module.exports = extractPage;