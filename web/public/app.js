const statusPill = document.getElementById("statusPill");
const statusText = document.getElementById("statusText");
const domainSelect = document.getElementById("domainSelect");
const questionInput = document.getElementById("questionInput");
const urlInput = document.getElementById("urlInput");
const askBtn = document.getElementById("askBtn");
const ingestBtn = document.getElementById("ingestBtn");
const ingestStatus = document.getElementById("ingestStatus");
const metaHint = document.getElementById("metaHint");
const samples = document.getElementById("samples");
const pipeline = document.getElementById("pipeline");
const emptyState = document.getElementById("emptyState");
const progressPanel = document.getElementById("progressPanel");
const resultState = document.getElementById("resultState");
const errorState = document.getElementById("errorState");
const answerBody = document.getElementById("answerBody");
const answerMeta = document.getElementById("answerMeta");
const sourcesList = document.getElementById("sourcesList");
const progressStage = document.getElementById("progressStage");
const progressTitle = document.getElementById("progressTitle");
const progressDetail = document.getElementById("progressDetail");
const progressPercent = document.getElementById("progressPercent");
const progressFill = document.getElementById("progressFill");
const progressTip = document.getElementById("progressTip");
const progressUrl = document.getElementById("progressUrl");
const progressLog = document.getElementById("progressLog");
const learnSteps = document.getElementById("learnSteps");

const STAGE_ORDER = ["crawling", "chunking", "saving", "embedding", "done"];

const STAGE_LABELS = {
  queued: "Queued",
  crawling: "Browsing the site",
  chunking: "Extracting & chunking",
  saving: "Saving to database",
  embedding: "Creating embeddings",
  done: "Ready",
  failed: "Failed"
};

function setStatus(ok, text) {
  statusPill.classList.toggle("ok", !!ok);
  statusPill.classList.toggle("bad", ok === false);
  statusText.textContent = text;
}

function setPipeline(step) {
  pipeline.querySelectorAll("li").forEach((li) => {
    li.classList.toggle("active", li.dataset.step === step);
  });
}

function setIngestStatus(text, kind = "") {
  ingestStatus.textContent = text;
  ingestStatus.classList.remove("busy", "ok", "bad");
  if (kind) ingestStatus.classList.add(kind);
}

function showEmpty() {
  emptyState.classList.remove("hidden");
  progressPanel.classList.add("hidden");
  resultState.classList.add("hidden");
  errorState.classList.add("hidden");
  emptyState.innerHTML = `<h2>Ready when you are</h2><p>Add a website URL above, or pick a domain you already crawled, then ask a sales question.</p>`;
}

function showError(message) {
  emptyState.classList.add("hidden");
  progressPanel.classList.add("hidden");
  resultState.classList.add("hidden");
  errorState.classList.remove("hidden");
  errorState.innerHTML = `<h2>Something went wrong</h2><p>${escapeHtml(message)}</p>`;
}

function showProgress(job) {
  emptyState.classList.add("hidden");
  resultState.classList.add("hidden");
  errorState.classList.add("hidden");
  progressPanel.classList.remove("hidden");

  const stage = job.stage || "crawling";
  const percent = Math.max(0, Math.min(100, Number(job.percent || 0)));

  progressStage.textContent = STAGE_LABELS[stage] || stage;
  progressTitle.textContent = job.title || STAGE_LABELS[stage] || "Working…";
  progressDetail.textContent = job.detail || job.message || "Learning this website…";
  progressTip.textContent = job.tip || "Follow the live activity below while we work.";
  progressPercent.textContent = `${Math.round(percent)}%`;
  progressFill.style.width = `${percent}%`;

  if (job.currentUrl) {
    progressUrl.textContent = job.pagesDone
      ? `Page ${job.pagesDone}${job.pagesTotal ? ` / ${job.pagesTotal}` : ""} · ${job.currentUrl}`
      : job.currentUrl;
  } else {
    progressUrl.textContent = "";
  }

  const stageIndex = STAGE_ORDER.indexOf(stage === "failed" ? "crawling" : stage);

  learnSteps.querySelectorAll("li").forEach((li) => {
    const idx = STAGE_ORDER.indexOf(li.dataset.stage);
    li.classList.toggle("active", li.dataset.stage === stage);
    li.classList.toggle("done", stageIndex > idx || stage === "done");
  });

  const lines = job.log || [];
  progressLog.innerHTML = lines
    .slice(-12)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("");

  progressLog.scrollTop = progressLog.scrollHeight;
}

function showResult(payload) {
  emptyState.classList.add("hidden");
  progressPanel.classList.add("hidden");
  errorState.classList.add("hidden");
  resultState.classList.remove("hidden");

  answerBody.textContent = payload.answer || "";

  const parts = [];
  if (payload.provider && payload.model) {
    parts.push(`${payload.provider} · ${payload.model}`);
  }
  if (payload.elapsedMs) {
    parts.push(`${(payload.elapsedMs / 1000).toFixed(1)}s`);
  }
  if (payload.usage?.total_tokens) {
    parts.push(`${payload.usage.total_tokens} tokens`);
  }
  answerMeta.textContent = parts.join("  ·  ");

  sourcesList.innerHTML = "";

  if (!payload.sources?.length) {
    sourcesList.innerHTML = `<p class="sources-note">No sources passed the similarity threshold.</p>`;
    return;
  }

  payload.sources.forEach((source) => {
    const el = document.createElement("article");
    el.className = "source";
    el.innerHTML = `
      <div class="source-top">
        <a href="${escapeAttr(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.url)}</a>
        <span class="score">${Number(source.similarity || 0).toFixed(3)}</span>
      </div>
      ${source.heading ? `<p class="source-heading">${escapeHtml(source.heading)}</p>` : ""}
      <p class="source-excerpt">${escapeHtml(source.excerpt || "")}${source.excerpt?.length >= 280 ? "…" : ""}</p>
    `;
    sourcesList.appendChild(el);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(res) {
  const type = res.headers.get("content-type") || "";
  const text = await res.text();

  if (!type.includes("application/json")) {
    throw new Error(
      "Server returned a webpage instead of API data. Run `npm run web` and open http://localhost:3000 (keep that terminal open)."
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Server returned invalid JSON. Restart `npm run web` and try again.");
  }
}

async function loadHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await readJson(res);

    if (!res.ok || !data.ok) {
      setStatus(false, data.error || "DB offline");
      metaHint.textContent = data.hint || "Start Postgres with npm run db:up";
      return;
    }

    setStatus(true, `${data.provider} · ${data.stats.embedded} embedded chunks`);
    metaHint.textContent = `${data.stats.websites} sites · ${data.stats.pages} pages · ${data.stats.chunks} chunks`;
  } catch (err) {
    setStatus(false, "Server unreachable");
    metaHint.textContent = err.message || "Run npm run web";
  }
}

async function loadWebsites(preferredDomain = null) {
  try {
    const res = await fetch("/api/websites");
    const data = await readJson(res);

    domainSelect.innerHTML = "";

    if (!res.ok) {
      domainSelect.innerHTML = `<option value="">${escapeHtml(data.error || "Failed to load")}</option>`;
      return;
    }

    const sites = data.websites || [];

    if (!sites.length) {
      domainSelect.innerHTML = `<option value="">No websites yet — add a URL above</option>`;
      return;
    }

    sites.forEach((site) => {
      const opt = document.createElement("option");
      opt.value = site.domain;
      opt.textContent = `${site.domain} (${site.embedded}/${site.chunks} embedded)`;
      domainSelect.appendChild(opt);
    });

    if (preferredDomain && sites.some((s) => s.domain === preferredDomain)) {
      domainSelect.value = preferredDomain;
      return;
    }

    const stripe = sites.find((s) => s.domain.includes("stripe"));
    if (stripe) domainSelect.value = stripe.domain;
  } catch (err) {
    domainSelect.innerHTML = `<option value="">${escapeHtml(err.message || "Could not load websites")}</option>`;
  }
}

async function pollIngestJob(jobId) {
  while (true) {
    const res = await fetch(`/api/ingest/${jobId}`);
    const job = await readJson(res);

    if (!res.ok) {
      throw new Error(job.error || "Could not check ingest status");
    }

    setIngestStatus(job.detail || job.message || job.stage, "busy");
    showProgress(job);

    if (job.status === "done") return job;
    if (job.status === "failed") {
      throw new Error(job.error || job.message || "Ingest failed");
    }

    await sleep(900);
  }
}

async function ingestWebsite() {
  const url = urlInput.value.trim();

  if (!url) {
    urlInput.focus();
    setIngestStatus("Paste a website URL first.", "bad");
    return;
  }

  ingestBtn.disabled = true;
  askBtn.disabled = true;
  ingestBtn.textContent = "Learning…";
  setIngestStatus("Starting…", "busy");
  showProgress({
    stage: "crawling",
    title: "Getting ready",
    detail: "Preparing to browse the company website…",
    tip: "We’ll show each step live — browsing, extracting, saving, embedding.",
    percent: 1,
    log: ["Starting…"]
  });

  try {
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, maxPages: 30 })
    });

    const data = await readJson(res);

    if (!res.ok) {
      throw new Error(data.error || "Could not start ingest");
    }

    const job = await pollIngestJob(data.id);
    const domain = job.domain || job.result?.domain;

    setIngestStatus(
      `Ready — ${domain} (${job.result?.pages || 0} pages, ${job.result?.chunks || 0} chunks)`,
      "ok"
    );

    await loadWebsites(domain);
    await loadHealth();

    showProgress({
      ...job,
      stage: "done",
      title: `${domain} is ready`,
      detail: "Ask a sales question below. Answers will use pages from this site.",
      tip: "Try pricing, services, or how to contact sales.",
      percent: 100
    });
  } catch (err) {
    setIngestStatus(err.message || "Ingest failed", "bad");
    showError(err.message || "Ingest failed");
  } finally {
    ingestBtn.disabled = false;
    askBtn.disabled = false;
    ingestBtn.textContent = "Learn site";
  }
}

async function askQuestion() {
  const question = questionInput.value.trim();
  const domain = domainSelect.value || null;

  if (!question) {
    questionInput.focus();
    return;
  }

  if (!domain) {
    showError("Add a website URL first (or pick one from the knowledge base).");
    return;
  }

  askBtn.disabled = true;
  askBtn.textContent = "Thinking…";
  setPipeline("retrieve");
  progressPanel.classList.add("hidden");
  emptyState.classList.remove("hidden");
  resultState.classList.add("hidden");
  errorState.classList.add("hidden");
  emptyState.innerHTML = `<h2>Retrieving context…</h2><p>Searching crawled pages for the best matching excerpts.</p>`;

  const stageTimers = [
    setTimeout(() => {
      setPipeline("ground");
      emptyState.innerHTML = `<h2>Grounding the answer…</h2><p>Building a prompt only from retrieved website text.</p>`;
    }, 700),
    setTimeout(() => {
      setPipeline("answer");
      emptyState.innerHTML = `<h2>Writing the answer…</h2><p>The LLM can only use the retrieved sources.</p>`;
    }, 1600)
  ];

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, domain })
    });

    const data = await readJson(res);

    stageTimers.forEach(clearTimeout);
    setPipeline("answer");

    if (!res.ok) {
      showError(data.hint ? `${data.error} (${data.hint})` : (data.error || "Ask failed"));
      return;
    }

    showResult(data);
  } catch (err) {
    stageTimers.forEach(clearTimeout);
    showError(err.message || "Network error");
  } finally {
    askBtn.disabled = false;
    askBtn.textContent = "Ask";
  }
}

samples.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-q]");
  if (!btn) return;
  questionInput.value = btn.dataset.q;
  questionInput.focus();
});

askBtn.addEventListener("click", askQuestion);
ingestBtn.addEventListener("click", ingestWebsite);

urlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    ingestWebsite();
  }
});

questionInput.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    askQuestion();
  }
});

loadHealth();
loadWebsites();
showEmpty();
