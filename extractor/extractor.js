async function extractPage(page) {

    return await page.evaluate(() => {

        const clean = text =>
            text?.replace(/\s+/g, " ").trim() || "";

        const SKIP_TAGS = new Set([
            "SCRIPT",
            "STYLE",
            "NOSCRIPT",
            "SVG",
            "IFRAME"
        ]);

        function isInChrome(el) {

            return !!el.closest(
                "footer, nav, header, aside, " +
                "[role='navigation'], [role='contentinfo'], [role='banner'], " +
                "[role='complementary'], [class*='Footer'], [class*='footer'], " +
                "[id*='footer'], [id*='Footer']"
            );

        }

        function getListItems(list) {

            const items = [];

            list.querySelectorAll(":scope > li").forEach(li => {

                const text = clean(li.innerText);

                if (text)
                    items.push(text);

            });

            return items;

        }

        function getTableRows(table) {

            const rows = [];

            table.querySelectorAll("tr").forEach(tr => {

                const cols = [];

                tr.querySelectorAll("th,td").forEach(cell => {

                    cols.push(clean(cell.innerText));

                });

                rows.push(cols);

            });

            return rows;

        }

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

        // Document order — required for section → paragraph grouping
        const elements = [];

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_ELEMENT,
            {
                acceptNode(node) {

                    if (SKIP_TAGS.has(node.tagName))
                        return NodeFilter.FILTER_REJECT;

                    if (isInChrome(node))
                        return NodeFilter.FILTER_REJECT;

                    const tag = node.tagName;

                    if (/^H[1-6]$/.test(tag))
                        return NodeFilter.FILTER_ACCEPT;

                    if (tag === "P") {

                        // Paragraphs inside lists/tables belong to those blocks
                        if (node.closest("li, td, th"))
                            return NodeFilter.FILTER_REJECT;

                        return NodeFilter.FILTER_ACCEPT;

                    }

                    if (tag === "UL" || tag === "OL") {

                        if (node.closest("li"))
                            return NodeFilter.FILTER_SKIP;

                        return NodeFilter.FILTER_ACCEPT;

                    }

                    if (tag === "TABLE")
                        return NodeFilter.FILTER_ACCEPT;

                    if (
                        tag === "TR" ||
                        tag === "TD" ||
                        tag === "TH" ||
                        tag === "TBODY" ||
                        tag === "THEAD" ||
                        tag === "TFOOT"
                    ) {
                        if (node.closest("table"))
                            return NodeFilter.FILTER_REJECT;
                    }

                    if (tag === "LI" && node.closest("ul, ol"))
                        return NodeFilter.FILTER_REJECT;

                    if (
                        tag === "BUTTON" ||
                        (tag === "INPUT" &&
                            (node.type === "button" || node.type === "submit"))
                    ) {
                        return NodeFilter.FILTER_ACCEPT;
                    }

                    return NodeFilter.FILTER_SKIP;

                }
            }
        );

        while (walker.nextNode()) {

            const el = walker.currentNode;
            const tag = el.tagName;

            if (/^H[1-6]$/.test(tag)) {

                const text = clean(el.innerText);

                if (!text)
                    continue;

                const data = { level: tag, text };

                headings.push(data);
                elements.push({ type: "heading", ...data });
                continue;

            }

            if (tag === "P") {

                const text = clean(el.innerText);

                if (text.length <= 30)
                    continue;

                paragraphs.push(text);
                elements.push({ type: "paragraph", text });
                continue;

            }

            if (tag === "UL" || tag === "OL") {

                const items = getListItems(el);

                if (!items.length)
                    continue;

                lists.push(items);
                elements.push({ type: "list", items });
                continue;

            }

            if (tag === "TABLE") {

                const rows = getTableRows(el);

                if (!rows.length)
                    continue;

                tables.push(rows);
                elements.push({ type: "table", rows });
                continue;

            }

            if (
                tag === "BUTTON" ||
                (tag === "INPUT" &&
                    (el.type === "button" || el.type === "submit"))
            ) {

                const data = {
                    text: clean(el.innerText) || clean(el.value),
                    type: el.type || "button"
                };

                if (!data.text)
                    continue;

                buttons.push(data);
                elements.push({ type: "button", ...data });

            }

        }

        /* -------- SPA / card content (pricing often lives in divs, not <p>) -------- */

        const seenText = new Set(
            elements
                .filter(el => el.type === "paragraph" || el.type === "heading")
                .map(el => (el.text || "").toLowerCase())
        );

        function pushParagraph(text) {

            const normalized = clean(text);

            if (!normalized || normalized.length < 12)
                return;

            const key = normalized.toLowerCase();

            if (seenText.has(key))
                return;

            seenText.add(key);
            paragraphs.push(normalized);
            elements.push({ type: "paragraph", text: normalized });

        }

        function pushHeading(text, level = "H3") {

            const normalized = clean(text);

            if (!normalized || normalized.length < 2 || normalized.length > 120)
                return;

            const key = normalized.toLowerCase();

            if (seenText.has(key))
                return;

            seenText.add(key);
            const data = { level, text: normalized };
            headings.push(data);
            elements.push({ type: "heading", ...data });

        }

        const PRICE_LIKE =
            /[₹$€£]\s?\d|early bird|\bper\s+(month|year|mo|yr)\b|\/\s*(mo|month|year|yr)\b|\b\d+\s*\/\s*(mo|month|year)\b/i;

        const root = document.querySelector("main") || document.body;

        root.querySelectorAll("h1,h2,h3,h4,h5,h6").forEach(h => {

            if (isInChrome(h))
                return;

            pushHeading(h.innerText, h.tagName);

        });

        root.querySelectorAll("div, section, article, li, span").forEach(el => {

            if (isInChrome(el))
                return;

            // Prefer leaf-ish cards so parent wrappers don't duplicate everything
            const childBlocks = el.querySelectorAll(":scope > div, :scope > section, :scope > article");

            if (childBlocks.length > 3)
                return;

            const text = clean(el.innerText);

            if (!text || text.length < 16 || text.length > 900)
                return;

            if (!PRICE_LIKE.test(text))
                return;

            // If this node is mostly nested content already captured, skip huge parents
            if (el.children.length > 12 && text.length > 500)
                return;

            pushParagraph(text);

        });

        // Last resort: split main text when almost nothing structured was found
        const structuredCount = elements.filter(
            el => el.type === "heading" || el.type === "paragraph" || el.type === "list"
        ).length;

        if (structuredCount < 4) {

            const mainText = clean(root.innerText || "");

            if (mainText.length > 80) {

                mainText
                    .split(/\n+/)
                    .map(clean)
                    .filter(line => line.length >= 24 && line.length <= 500)
                    .slice(0, 40)
                    .forEach(pushParagraph);

            }

        }

        /* ---------------- Links / images / forms (metadata only) ---------------- */

        document.querySelectorAll("a[href]").forEach(link => {

            if (isInChrome(link))
                return;

            const data = {
                text: clean(link.innerText),
                href: link.href
            };

            links.push(data);

        });

        document.querySelectorAll("img").forEach(img => {

            if (isInChrome(img))
                return;

            images.push({
                src: img.src,
                alt: clean(img.alt),
                width: img.width,
                height: img.height
            });

        });

        document.querySelectorAll("form").forEach(form => {

            if (isInChrome(form))
                return;

            const fields = [];

            form.querySelectorAll("input,textarea,select").forEach(field => {

                fields.push({
                    name: field.name,
                    type: field.type || field.tagName,
                    placeholder: field.placeholder || ""
                });

            });

            forms.push({
                action: form.action,
                method: form.method || "GET",
                fields
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
