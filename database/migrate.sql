-- Allow crawl to save chunk text before embeddings exist

ALTER TABLE chunks ALTER COLUMN model DROP NOT NULL;
ALTER TABLE chunks ALTER COLUMN embedding DROP NOT NULL;
ALTER TABLE chunks ALTER COLUMN embedded_at DROP NOT NULL;

DROP INDEX IF EXISTS chunks_embedding_hnsw_idx;

CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw_idx
    ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WHERE embedding IS NOT NULL;
