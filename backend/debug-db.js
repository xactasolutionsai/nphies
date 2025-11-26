import { query } from './db.js';

async function debugDatabase() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ Database connected:', result.rows[0]);
    
    // Check what tables exist
    console.log('\n🔍 Checking tables...');
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('📋 Available tables:', tables.rows.map(row => row.table_name));
    
    // Test each table that should exist
    const expectedTables = ['patients', 'providers', 'insurers', 'authorizations', 'eligibility', 'claims', 'claim_batches', 'payments'];
    
    for (const table of expectedTables) {
      try {
        const count = await query(`SELECT COUNT(*) as total FROM ${table}`);
        console.log(`✅ ${table}: ${count.rows[0].total} records`);
      } catch (error) {
        console.log(`❌ ${table}: ERROR - ${error.message}`);
      }
    }
    
    // Test dashboard queries specifically
    console.log('\n🔍 Testing dashboard queries...');
    
    try {
      const patientsCount = await query('SELECT COUNT(*) as total FROM patients');
      console.log('✅ Patients count:', patientsCount.rows[0].total);
    } catch (error) {
      console.log('❌ Patients count error:', error.message);
    }
    
    try {
      const eligibilityCount = await query('SELECT COUNT(*) as total FROM eligibility');
      console.log('✅ Eligibility count:', eligibilityCount.rows[0].total);
    } catch (error) {
      console.log('❌ Eligibility count error:', error.message);
    }
    
    try {
      const claimsByStatus = await query(`
        SELECT status, COUNT(*) as count 
        FROM claims 
        GROUP BY status
      `);
      console.log('✅ Claims by status:', claimsByStatus.rows);
    } catch (error) {
      console.log('❌ Claims by status error:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  }
}

debugDatabase();
