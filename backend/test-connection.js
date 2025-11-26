import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nafes_healthcare',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    console.log('Database config:', {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'nafes_healthcare',
      user: process.env.DB_USER || 'postgres'
    });

    const client = await pool.connect();
    console.log('✅ Connected to database successfully!');

    // Test if tables exist
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('patients', 'providers', 'insurers', 'authorizations', 'eligibility_requests', 'claims', 'claim_batches', 'payments')
      ORDER BY table_name
    `);

    console.log('📋 Existing tables:');
    if (result.rows.length === 0) {
      console.log('❌ No tables found! You need to run the schema first.');
    } else {
      result.rows.forEach(row => console.log(`   ✅ ${row.table_name}`));
    }

    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();
