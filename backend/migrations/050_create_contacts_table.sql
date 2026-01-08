-- Migration: Create contacts table
-- Date: 2026-01-08
-- Purpose: Store contact form submissions from external websites

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    message TEXT NOT NULL,
    source_url VARCHAR(500),        -- Track which website sent the form
    ip_address VARCHAR(45),         -- For spam prevention (supports IPv6)
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON contacts(created_at DESC);

-- Create index on email for searching
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Add comment to table
COMMENT ON TABLE contacts IS 'Stores contact form submissions from external websites';
COMMENT ON COLUMN contacts.source_url IS 'The URL of the website that submitted the form';
COMMENT ON COLUMN contacts.ip_address IS 'IP address of the submitter for spam prevention';
COMMENT ON COLUMN contacts.status IS 'Contact status: new, read, replied, or archived';
