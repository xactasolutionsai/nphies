-- Fix embedding dimension mismatch for medical_knowledge: vector(768) -> vector(4096)
-- (ragService stores 4096-dimension embeddings).
--
-- Idempotent and non-destructive: this file used to DROP and recreate the table,
-- deleting all stored knowledge. Now it only changes the column type when it is
-- not already vector(4096); embeddings of another dimension are set to NULL (they
-- cannot be cast) and must be regenerated with `npm run seed-medical-knowledge`.
-- The ivfflat index is dropped because pgvector indexes support at most 2000 dimensions.

DO $$
DECLARE
    current_dim integer;
BEGIN
    SELECT a.atttypmod INTO current_dim
    FROM pg_attribute a
    WHERE a.attrelid = 'medical_knowledge'::regclass AND a.attname = 'embedding' AND NOT a.attisdropped;

    IF current_dim IS DISTINCT FROM 4096 THEN
        DROP INDEX IF EXISTS medical_knowledge_embedding_idx;
        UPDATE medical_knowledge SET embedding = NULL WHERE embedding IS NOT NULL;
        ALTER TABLE medical_knowledge ALTER COLUMN embedding TYPE vector(4096);
        RAISE NOTICE 'medical_knowledge.embedding changed to vector(4096); existing embeddings cleared';
    END IF;
END $$;
