import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function updateAdminPassword() {
  try {
    const email = 'eng.anasshamia@gmail.com';
    const password = '123123';

    // Check if admin user exists
    const existingUser = await query(
      'SELECT id, email FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length === 0) {
      console.log('❌ Admin user not found!');
      console.log('   Email:', email);
      console.log('   Please run the migration first: backend/migrations/049_create_admin_user.sql');
      process.exit(1);
      return;
    }

    // Hash password with fresh salt
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Update admin user password
    const result = await query(
      'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE email = $2 RETURNING id, email, updated_at',
      [passwordHash, email]
    );

    const user = result.rows[0];

    console.log('✅ Super admin password updated successfully!');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Password: 123123');
    console.log('   Updated at:', user.updated_at);
    
    // Verify the password works
    const verifyResult = await query(
      'SELECT password_hash FROM users WHERE email = $1',
      [email]
    );
    const isValid = await bcrypt.compare(password, verifyResult.rows[0].password_hash);
    console.log('   Password verification:', isValid ? '✅ Valid' : '❌ Invalid');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin password:', error.message);
    if (error.code === '42P01') {
      console.error('   Error: users table does not exist. Please run the migration first!');
      console.error('   Migration file: backend/migrations/048_create_users_table.sql');
    }
    process.exit(1);
  }
}

updateAdminPassword();

