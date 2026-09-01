const path = require("path");

require("dotenv").config({
    path: path.join(__dirname, ".env")
});

const express = require("express");
const cors = require("cors");
const { ask } = require("./rag");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        message: "SalesRAG API is running",
        endpoints: {
            health: "GET /health",
            ask: "POST /ask  { question, domain? }"
        }
    });
});

app.get("/health", (req, res) => {
    res.json({
        status: "ok"
    });
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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`SalesRAG API running on http://localhost:${PORT}`);
    
});
