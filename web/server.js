const path = require("path");
const express = require("express");
const crypto = require("crypto");

require("dotenv").config({
    path: path.join(__dirname, "..", ".env")
});

const { answerQuestion } = require("../rag/ragAgent");
const ragConfig = require("../rag/config");
const { listWebsites, countStats } = require("../database/repository");
const { ingestWebsite, normalizeStartUrl } = require("../pipeline/ingestWebsite");

const app = express();
const PORT = Number(process.env.PORT || 3000);

const jobs = new Map();
let ingestBusy = false;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function publicJob(job) {

    return {
        id: job.id,
        status: job.status,
        stage: job.stage,
        title: job.title,
        message: job.message,
        detail: job.detail,
        tip: job.tip,
        percent: job.percent,
        currentUrl: job.currentUrl,
        pagesDone: job.pagesDone,
        pagesTotal: job.pagesTotal,
        log: job.log || [],
        url: job.url,
        domain: job.domain,
        error: job.error,
        result: job.result,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
    };

}

function updateJob(job, patch) {

    const next = { ...patch, updatedAt: new Date().toISOString() };

    if (patch.logLine || patch.log) {

        const line = patch.logLine || patch.log;
        job.log = [...(job.log || []), String(line)].slice(-40);
        delete next.log;
        delete next.logLine;

    }

    if (patch.message && !patch.detail)
        next.detail = patch.message;

    Object.assign(job, next);
    jobs.set(job.id, job);

}

async function runIngestJob(job) {

    ingestBusy = true;

    try {

        updateJob(job, {
            status: "running",
            stage: "crawling",
            title: "Starting…",
            message: "Starting crawl…",
            detail: "Getting ready to browse the company website",
            tip: "Sit tight — live updates will appear as we go.",
            percent: 1,
            logLine: `Started learning ${job.url}`
        });

        const result = await ingestWebsite(job.url, {
            maxPages: job.maxPages,
            onProgress(progress) {

                updateJob(job, {
                    stage: progress.stage || job.stage,
                    title: progress.title || job.title,
                    message: progress.detail || progress.message || job.message,
                    detail: progress.detail || progress.message || job.detail,
                    tip: progress.tip || job.tip,
                    percent: progress.percent ?? job.percent,
                    currentUrl: progress.currentUrl || job.currentUrl,
                    pagesDone: progress.pagesDone ?? job.pagesDone,
                    pagesTotal: progress.pagesTotal ?? job.pagesTotal,
                    logLine: progress.log || progress.logLine
                });

            }
        });

        updateJob(job, {
            status: "done",
            stage: "done",
            title: "Ready to answer questions",
            message: `Ready — ${result.domain}`,
            detail: `${result.domain} is in the knowledge base`,
            tip: "Ask about pricing, services, or contact sales.",
            percent: 100,
            domain: result.domain,
            result,
            logLine: `Finished ${result.domain}`
        });

    } catch (err) {

        updateJob(job, {
            status: "failed",
            stage: "failed",
            title: "Something went wrong",
            message: err.message || err.code || "Ingest failed",
            detail: err.message || err.code || "Ingest failed",
            tip: "Check the URL and that Postgres is running, then try again.",
            percent: job.percent || 0,
            error: err.message || err.code || "Ingest failed",
            logLine: `Failed: ${err.message || err.code || "unknown error"}`
        });

    } finally {

        ingestBusy = false;

    }

}

app.get("/api/health", async (_req, res) => {

    try {

        const stats = await countStats();

        res.json({
            ok: true,
            provider: ragConfig.provider,
            model: ragConfig.model,
            ingestBusy,
            stats
        });

    } catch (err) {

        res.status(503).json({
            ok: false,
            error: err.message || err.code || "Database unavailable",
            hint: err.code === "ECONNREFUSED"
                ? "Start Postgres with: npm run db:up"
                : undefined
        });

    }

});

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

app.post("/api/ingest", async (req, res) => {

    if (ingestBusy) {

        return res.status(409).json({
            error: "Another website is already being learned. Please wait."
        });

    }

    const url = normalizeStartUrl(req.body?.url);
    const maxPages = Math.min(
        Math.max(Number(req.body?.maxPages || 30), 5),
        50
    );

    if (!url) {

        return res.status(400).json({
            error: "Enter a valid website URL (e.g. https://stripe.com)"
        });

    }

    const job = {
        id: crypto.randomUUID(),
        status: "queued",
        stage: "queued",
        title: "Queued",
        message: "Queued…",
        detail: "Waiting to start…",
        tip: "We’ll browse the site, extract content, then make it searchable.",
        percent: 0,
        currentUrl: url,
        pagesDone: 0,
        pagesTotal: maxPages,
        log: [],
        url,
        domain: null,
        maxPages,
        error: null,
        result: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    jobs.set(job.id, job);

    // Fire and forget — client polls /api/ingest/:id
    setImmediate(() => runIngestJob(job));

    res.status(202).json(publicJob(job));

});

app.get("/api/ingest/:id", (req, res) => {

    const job = jobs.get(req.params.id);

    if (!job) {

        return res.status(404).json({ error: "Job not found" });

    }

    res.json(publicJob(job));

});

app.post("/api/ask", async (req, res) => {

    const question = String(req.body?.question || "").trim();
    const domain = req.body?.domain
        ? String(req.body.domain).replace(/^www\./, "").toLowerCase()
        : null;

    if (!question) {

        return res.status(400).json({ error: "Question is required" });

    }

    try {

        const startedAt = Date.now();
        const result = await answerQuestion(question, { domain });

        res.json({
            question,
            domain,
            answer: result.answer,
            model: result.model,
            provider: ragConfig.provider,
            usage: result.usage,
            elapsedMs: Date.now() - startedAt,
            sources: (result.chunks || []).map(chunk => ({
                url: chunk.url,
                heading: chunk.heading || "",
                domain: chunk.domain,
                similarity: Number(chunk.similarity || 0),
                excerpt: String(chunk.text || "").slice(0, 280)
            }))
        });

    } catch (err) {

        const status = err.response?.status || 500;
        const detail =
            err.response?.data?.error?.message ||
            err.response?.data?.message ||
            err.message ||
            err.code ||
            "Ask failed";

        res.status(status >= 400 && status < 600 ? status : 500).json({
            error: detail,
            hint: err.code === "ECONNREFUSED"
                ? "Start Postgres with: npm run db:up"
                : undefined
        });

    }

});

// Never return the SPA HTML for API calls
app.use("/api", (_req, res) => {

    res.status(404).json({ error: "API route not found" });

});

app.get(["/", "/index.html"], (_req, res) => {

    res.sendFile(path.join(__dirname, "public", "index.html"));

});

app.use((req, res) => {

    if (req.method !== "GET" && req.method !== "HEAD") {

        return res.status(404).json({ error: "Not found" });

    }

    res.sendFile(path.join(__dirname, "public", "index.html"));

});

const server = app.listen(PORT, () => {

    console.log("--------------------------------");
    console.log("Sales Agent Demo UI");
    console.log("--------------------------------");
    console.log(`Open: http://localhost:${PORT}`);
    console.log(`Provider: ${ragConfig.provider} (${ragConfig.model})`);
    console.log("");
    console.log("Keep this terminal open while using the demo.");
    console.log("");

});

server.on("error", (err) => {

    if (err.code === "EADDRINUSE") {

        console.error(`Port ${PORT} is already in use. Stop the other process or set PORT=...`);

    } else {

        console.error("Web server failed:", err.message || err);

    }

    process.exit(1);

});
