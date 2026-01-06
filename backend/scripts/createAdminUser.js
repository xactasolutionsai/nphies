import bcrypt from 'bcryptjs';
import { query } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

async function createAdminUser() {
  try {
    const email = 'eng.anasshamia@gmail.com';
    const password = '123123';

    // Check if admin user already exists
    const existingUser = await query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      console.log('❌ Admin user already exists!');
      console.log('   Email:', email);
      return;
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert admin user
    const result = await query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];

    console.log('✅ Super admin user created successfully!');
    console.log('   ID:', user.id);
    console.log('   Email:', user.email);
    console.log('   Password: 123123');
    console.log('   Created at:', user.created_at);
    console.log('\n⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    if (error.code === '42P01') {
      console.error('   Error: users table does not exist. Please run the migration first!');
      console.error('   Migration file: backend/migrations/048_create_users_table.sql');
    }
    process.exit(1);
  }
}

createAdminUser();

