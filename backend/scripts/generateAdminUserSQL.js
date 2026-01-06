import bcrypt from 'bcryptjs';

async function generateSQL() {
  const email = 'admin@admin.com';
  const password = '123123';
  
  // Hash password
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  
  // Generate SQL query
  const sql = `-- Create super admin user
-- Email: admin@admin.com
-- Password: 123123

INSERT INTO users (email, password_hash) 
VALUES ('${email}', '${passwordHash}')
ON CONFLICT (email) DO NOTHING;

-- Verify the user was created
SELECT id, email, created_at FROM users WHERE email = '${email}';`;

  console.log(sql);
}

generateSQL().catch(console.error);

