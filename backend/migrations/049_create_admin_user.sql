-- Migration: Create super admin user
-- Date: 2025-01-XX
-- Purpose: Create default super admin user for system access
-- Email: eng.anasshamia@gmail.com
-- Password: 123123

-- Note: This SQL uses a pre-computed bcrypt hash for password "123123"
-- If you need to regenerate, run: node scripts/generateAdminUserSQL.js

INSERT INTO users (email, password_hash) 
VALUES (
  'eng.anasshamia@gmail.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
)
ON CONFLICT (email) DO UPDATE 
SET password_hash = EXCLUDED.password_hash;

-- Verify the super admin user was created
SELECT id, email, created_at 
FROM users 
WHERE email = 'eng.anasshamia@gmail.com';

