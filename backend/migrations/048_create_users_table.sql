-- Migration: Create users table for authentication
-- Date: 2025-01-XX
-- Purpose: Support simple email/password authentication

-- =====================================================
-- 1. Create users table
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- 2. Create indexes for better query performance
-- =====================================================

-- Index for email lookups (already unique, but explicit index for clarity)
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- =====================================================
-- 3. Add comments for documentation
-- =====================================================

COMMENT ON TABLE users IS 'Stores user accounts for authentication. Simple email/password system.';
COMMENT ON COLUMN users.email IS 'User email address (unique, used for login)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.updated_at IS 'Last account update timestamp';

