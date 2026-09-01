-- websites → pages → chunks (embedding vector(384))

CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS chunks CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS websites CASCADE;

CREATE TABLE websites (
    id          SERIAL PRIMARY KEY,
    domain      TEXT NOT NULL UNIQUE,
    start_url   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pages (
    id          SERIAL PRIMARY KEY,
    website_id  INTEGER NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
    url         TEXT NOT NULL UNIQUE,
    title       TEXT DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX pages_website_id_idx ON pages (website_id);

CREATE TABLE chunks (
    id           TEXT PRIMARY KEY,
    page_id      INTEGER NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
    heading      TEXT DEFAULT '',
    level        TEXT DEFAULT '',
    chunk_index  INTEGER DEFAULT 0,
    text         TEXT NOT NULL,
    model        TEXT,
    embedding    vector(384),
    embedded_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX chunks_page_id_idx ON chunks (page_id);

CREATE INDEX chunks_embedding_hnsw_idx
    ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;
