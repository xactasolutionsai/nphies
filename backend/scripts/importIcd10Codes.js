/**
 * ICD-10 Codes Import Script
 * 
 * This script parses the ICD-10 2019 Excel file and imports all codes
 * into the icd10_codes database table.
 * 
 * Usage: node scripts/importIcd10Codes.js
 * 
 * Prerequisites:
 * 1. Run the migration: backend/migrations/create_icd10_codes_table.sql
 * 2. Install xlsx package: npm install xlsx
 */

import xlsx from 'xlsx';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

// Database configuration
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nafes_healthcare',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

/**
 * Parse the ICD-10 Excel file and extract codes
 */
function parseExcelFile(filePath) {
  console.log(`📖 Reading Excel file: ${filePath}`);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON with header mapping
  const rawData = xlsx.utils.sheet_to_json(worksheet, { defval: null });
  
  console.log(`📊 Total rows in Excel: ${rawData.length}`);
  
  // Extract ICD-10 codes from the relevant columns
  // Note: xlsx library converts dots to underscores in column names
  // Based on analysis: code_6 = ICD code, kind_2 = type, Label_2 = description
  const codes = [];
  
  for (const row of rawData) {
    const code = row['code_6'];
    const codeType = row['kind_2'];
    const description = row['Label_2'];
    
    // Skip rows without valid code or description
    if (!code || !description) continue;
    
    // Normalize code type
    let normalizedType = 'category';
    if (codeType === 'chapter') normalizedType = 'chapter';
    else if (codeType === 'block') normalizedType = 'block';
    else if (codeType === 'category') normalizedType = 'category';
    else continue; // Skip unknown types
    
    // Clean up description (remove extra whitespace)
    const cleanDescription = String(description).trim().replace(/\s+/g, ' ');
    
    // Skip if description is too short or just whitespace
    if (cleanDescription.length < 2) continue;
    
    codes.push({
      code: String(code).trim(),
      description: cleanDescription,
      code_type: normalizedType,
      parent_code: determineParentCode(String(code).trim(), normalizedType)
    });
  }
  
  console.log(`✅ Extracted ${codes.length} valid ICD-10 codes`);
  
  // Log breakdown by type
  const typeBreakdown = codes.reduce((acc, c) => {
    acc[c.code_type] = (acc[c.code_type] || 0) + 1;
    return acc;
  }, {});
  console.log('📈 Breakdown by type:', typeBreakdown);
  
  return codes;
}

/**
 * Determine the parent code based on ICD-10 hierarchy
 */
function determineParentCode(code, codeType) {
  if (codeType === 'chapter') {
    return null; // Chapters have no parent
  }
  
  if (codeType === 'block') {
    // Blocks belong to chapters, but we don't track that relationship
    return null;
  }
  
  if (codeType === 'category') {
    // Categories with decimals (e.g., A00.1) have parent category (e.g., A00)
    if (code.includes('.')) {
      return code.split('.')[0];
    }
    // Base categories (e.g., A00) belong to blocks, but we simplify
    return null;
  }
  
  return null;
}

/**
 * Import codes into the database using batch inserts
 */
async function importCodes(codes) {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting database import...');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Clear existing data (optional - comment out to preserve existing data)
    console.log('🗑️  Clearing existing ICD-10 codes...');
    await client.query('DELETE FROM icd10_codes');
    
    // Batch insert for better performance
    const batchSize = 500;
    let insertedCount = 0;
    
    for (let i = 0; i < codes.length; i += batchSize) {
      const batch = codes.slice(i, i + batchSize);
      
      // Build parameterized query for batch insert
      const values = [];
      const placeholders = [];
      
      batch.forEach((code, index) => {
        const offset = index * 4;
        placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        values.push(code.code, code.description, code.code_type, code.parent_code);
      });
      
      const query = `
        INSERT INTO icd10_codes (code, description, code_type, parent_code)
        VALUES ${placeholders.join(', ')}
        ON CONFLICT (code) DO UPDATE SET
          description = EXCLUDED.description,
          code_type = EXCLUDED.code_type,
          parent_code = EXCLUDED.parent_code
      `;
      
      await client.query(query, values);
      insertedCount += batch.length;
      
      // Progress indicator
      const progress = Math.round((insertedCount / codes.length) * 100);
      process.stdout.write(`\r📥 Importing: ${insertedCount}/${codes.length} (${progress}%)`);
    }
    
    console.log('\n');
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log(`✅ Successfully imported ${insertedCount} ICD-10 codes`);
    
    // Verify import
    const result = await client.query('SELECT COUNT(*) as count FROM icd10_codes');
    console.log(`📊 Total codes in database: ${result.rows[0].count}`);
    
    // Show sample codes
    const sampleResult = await client.query(`
      SELECT code, description, code_type 
      FROM icd10_codes 
      WHERE code_type = 'category'
      ORDER BY code 
      LIMIT 10
    `);
    console.log('\n📋 Sample category codes:');
    sampleResult.rows.forEach(row => {
      console.log(`   ${row.code}: ${row.description}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Main function
 */
async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('       ICD-10 Codes Import Script');
  console.log('═══════════════════════════════════════════════════════\n');
  
  try {
    // Path to the Excel file
    const excelPath = path.join(__dirname, '..', '..', 'docs', 'icd102019en.xml.xlsx');
    
    // Parse Excel file
    const codes = parseExcelFile(excelPath);
    
    if (codes.length === 0) {
      console.error('❌ No valid codes found in Excel file');
      process.exit(1);
    }
    
    // Import to database
    await importCodes(codes);
    
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('       Import completed successfully!');
    console.log('═══════════════════════════════════════════════════════\n');
    
  } catch (error) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
main();

