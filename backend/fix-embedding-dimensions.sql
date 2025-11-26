-- Fix embedding dimension mismatch
-- The database was created for 768 dimensions (OpenAI)
-- But Ollama's nomic-embed-text model uses 4096 dimensions

-- Drop the existing table and recreate with correct dimensions
DROP TABLE IF EXISTS medical_knowledge CASCADE;

CREATE TABLE medical_knowledge (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    category VARCHAR(255) DEFAULT 'ophthalmology',
    source VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    embedding vector(4096),  -- Changed from 768 to 4096 for Ollama
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search
CREATE INDEX IF NOT EXISTS medical_knowledge_embedding_idx 
ON medical_knowledge USING hnsw (embedding vector_cosine_ops);

-- Verify
SELECT 'medical_knowledge table recreated with 4096 dimensions' as status;

