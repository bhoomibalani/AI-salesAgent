const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");
const { ask } = require("./rag");
const ragConfig = require("./rag/config");
const { listWebsites, countStats } = require("./database/repository");

const app = express();
const publicDir = path.join(__dirname, "web", "public");

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

app.get("/health", async (_req, res) => {

    try {

        const stats = await countStats();

        res.json({
            status: "ok",
            ok: true,
            provider: ragConfig.provider,
            model: ragConfig.model,
            stats
        });

    } catch (err) {

        res.status(503).json({
            status: "error",
            ok: false,
            error: err.message || err.code || "Database unavailable"
        });

    }

});

// Used by the demo UI domain dropdown (no secrets returned)
app.get("/api/websites", async (_req, res) => {

    try {

        const websites = await listWebsites();

        res.json({
            websites: websites.map(site => ({
                domain: site.domain,
                startUrl: site.start_url,
                pages: site.pages,
                chunks: site.chunks,
                embedded: site.embedded
            }))
        });

    } catch (err) {

        res.status(500).json({
            error: err.message || err.code || "Failed to list websites"
        });

    }

});

app.post("/ask", async (req, res) => {

    const question = String(req.body?.question || "").trim();
    const domain = req.body?.domain
        ? String(req.body.domain).replace(/^www\./, "").toLowerCase()
        : null;

    if (!question) {
        return res.status(400).json({ error: "Question is required" });
    }

    try {

        const result = await ask(question, { domain });
        res.json(result);

    } catch (err) {

        console.error("Ask failed:", err.message || err);

        const status = err.message === "Question is required" ? 400 : 500;

        res.status(status).json({
            error: err.message || "Failed to answer question"
        });

    }

});

// SPA-style fallback: unknown non-API GET routes serve the UI
app.get("/", (_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`SalesRAG running on http://localhost:${PORT}`);
    console.log(`UI: GET /   ·  health: GET /health   ·  ask: POST /ask`);
});
