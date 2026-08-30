# Voice-Based Sales Agent

A website-grounded sales Q&A system. Crawl any company site, store it as searchable knowledge, and answer customer questions **only from that content** — no hallucinated pricing or features.

## Features

- **Multi-website knowledge base** — crawl multiple domains into one PostgreSQL + pgvector DB
- **Sales-focused crawling** — prioritizes pricing, products, features, contact; skips blog/noise
- **Local embeddings** — Hugging Face `all-MiniLM-L6-v2` (no API key for embeddings)
- **Intent-aware retrieval** — ranking tuned for pricing, products, “what is…”, contact questions
- **Grounded RAG answers** — Gemini or OpenAI; refuses to invent if context is missing
- **Demo UI** — paste a URL, watch crawl progress, ask questions, inspect sources

## Architecture
Website URL → Crawl (Playwright) → Clean + section extract + chunk → Embed (local HF model) → Store (PostgreSQL + pgvector) → Retrieve (semantic search + rerank) → Answer (Gemini / OpenAI RAG)



## Stack

| Layer | Tech |
|-------|------|
| Runtime | Node.js |
| Crawler | Playwright |
| Embeddings | `@huggingface/transformers` |
| Database | PostgreSQL + pgvector (Docker) |
| RAG LLM | Google Gemini (native) or OpenAI |
| Demo UI | Express + static frontend |

## Prerequisites

- Node.js 18+
- Docker (for Postgres)
- Playwright browsers: `npx playwright install`
- A Gemini API key **or** OpenAI API key (for answers only)

## Setup

```bash
# 1. Install dependencies
npm install
npx playwright install

# 2. Configure environment
cp .env.example .env
# Edit .env — set DATABASE_URL and GEMINI_API_KEY (or OPENAI_API_KEY)

# 3. Start database + apply schema
npm run db:setup

QUICK SETUP
npm run db:up          # if DB is not already running
npm run web            # http://localhost:3000


Paste a company URL (e.g. https://www.zipplyio.com/)
Click Learn site (crawl → chunk → embed)
Ask questions and review sources
Keep the npm run web terminal open while using the UI.
