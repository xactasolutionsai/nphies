import { faker } from '@faker-js/faker';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🔍 Debug: Starting script...');
console.log('🔍 Environment variables:');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***' : 'NOT SET');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nafes_healthcare',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function testConnection() {
  const client = await pool.connect();
  try {
    console.log('🔍 Testing database connection...');
    const result = await client.query('SELECT NOW()');
    console.log('✅ Database connected successfully!');
    console.log('Current time:', result.rows[0].now);
    
    // Test inserting a simple patient
    console.log('🔍 Testing patient insertion...');
    const insertResult = await client.query(`
      INSERT INTO patients (name, identifier, gender, birth_date, phone, email, address)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [
      'Test Patient',
      'TEST-001',
      'Male',
      '1990-01-01',
      '+966501234567',
      'test@example.com',
      'Test Address'
    ]);
    
    console.log('✅ Patient inserted successfully!');
    console.log('Patient ID:', insertResult.rows[0].id);
    
    // Check count
    const countResult = await client.query('SELECT COUNT(*) as count FROM patients');
    console.log('Total patients:', countResult.rows[0].count);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

testConnection();
