-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Create medical knowledge table for RAG
CREATE TABLE IF NOT EXISTS medical_knowledge (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    embedding vector(768), -- Default dimension for many models, adjust if needed
    metadata JSONB DEFAULT '{}'::jsonb,
    source VARCHAR(255),
    category VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index for vector similarity search (using cosine distance)
CREATE INDEX IF NOT EXISTS medical_knowledge_embedding_idx 
ON medical_knowledge 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create index for metadata searches
CREATE INDEX IF NOT EXISTS medical_knowledge_metadata_idx 
ON medical_knowledge 
USING gin (metadata);

-- Create index for category searches
CREATE INDEX IF NOT EXISTS medical_knowledge_category_idx 
ON medical_knowledge (category);

-- Create AI validations history table
CREATE TABLE IF NOT EXISTS ai_validations (
    id SERIAL PRIMARY KEY,
    form_id INTEGER,
    form_type VARCHAR(50) DEFAULT 'eye_approval',
    form_data JSONB NOT NULL,
    validation_result JSONB NOT NULL,
    model_used VARCHAR(100),
    confidence_score DECIMAL(3, 2),
    validation_time_ms INTEGER,
    is_valid BOOLEAN,
    warnings_count INTEGER DEFAULT 0,
    recommendations_count INTEGER DEFAULT 0,
    user_override BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for ai_validations table
CREATE INDEX IF NOT EXISTS ai_validations_form_id_idx 
ON ai_validations (form_id);

CREATE INDEX IF NOT EXISTS ai_validations_form_type_idx 
ON ai_validations (form_type);

CREATE INDEX IF NOT EXISTS ai_validations_created_at_idx 
ON ai_validations (created_at DESC);

-- Add foreign key constraint for eye_approvals (optional, can be added later)
-- ALTER TABLE ai_validations 
-- ADD CONSTRAINT fk_eye_approvals 
-- FOREIGN KEY (form_id) 
-- REFERENCES eye_approvals(id) 
-- ON DELETE CASCADE;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_medical_knowledge_updated_at 
BEFORE UPDATE ON medical_knowledge 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_validations_updated_at 
BEFORE UPDATE ON ai_validations 
FOR EACH ROW 
EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE medical_knowledge IS 'Stores medical guidelines and protocols with vector embeddings for RAG';
COMMENT ON TABLE ai_validations IS 'Stores AI validation history for medical forms';
COMMENT ON COLUMN medical_knowledge.embedding IS 'Vector embedding of the content for similarity search';
COMMENT ON COLUMN medical_knowledge.metadata IS 'Additional metadata like title, author, date, tags';
COMMENT ON COLUMN ai_validations.validation_result IS 'Complete validation result from AI including warnings and recommendations';

