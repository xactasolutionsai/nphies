import { query } from './db.js';

async function testSimple() {
  try {
    console.log('Testing simple query...');
    const result = await query('SELECT 1 as test');
    console.log('Simple query result:', result.rows[0]);
    
    console.log('Testing table existence...');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables found:', tables.rows.length);
    tables.rows.forEach(row => console.log('-', row.table_name));
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testSimple();
