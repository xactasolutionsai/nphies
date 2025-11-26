-- Fix embedding dimension mismatch
-- Change from 768 to 4096 dimensions for cniongolo/biomistral model

-- Drop the old index
DROP INDEX IF EXISTS idx_medicines_embedding;

-- Alter the embedding column to use 4096 dimensions
ALTER TABLE medicines 
ALTER COLUMN embedding TYPE vector(4096);

-- Note: ivfflat index has a max of 2000 dimensions, so we'll use HNSW if available
-- or no index for now (search will still work, just slower on very large datasets)

-- Try to create HNSW index (requires pgvector >= 0.5.0)
-- If this fails, the import will still work, just without index optimization
DO $$ 
BEGIN
    BEGIN
        CREATE INDEX idx_medicines_embedding 
        ON medicines USING hnsw (embedding vector_cosine_ops);
        RAISE NOTICE 'Created HNSW index successfully';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'HNSW index not available, continuing without index (search will still work)';
    END;
END $$;

-- Verify the change
SELECT column_name, data_type, udt_name 
FROM information_schema.columns 
WHERE table_name = 'medicines' AND column_name = 'embedding';

COMMENT ON COLUMN medicines.embedding IS 'Vector embedding (4096 dimensions) for RAG-based semantic search using cniongolo/biomistral model';

-- Clear any partial data that was imported with wrong dimensions
TRUNCATE TABLE medicine_brands CASCADE;
TRUNCATE TABLE medicine_codes CASCADE;
TRUNCATE TABLE medicines CASCADE;

SELECT 'Schema updated successfully! Embedding dimension is now 4096.' as status;

