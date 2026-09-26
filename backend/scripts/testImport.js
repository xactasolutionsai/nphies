import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FILES_DIR = path.join(__dirname, '..', '..', 'files');

console.log('\n🔍 TESTING IMPORT SETUP');
console.log('='.repeat(60));

// Test 1: Check CSV files exist
console.log('\n1️⃣ Checking CSV files...');
console.log(`Looking in: ${FILES_DIR}`);

const csvFiles = [
  'All_generic_v072124.csv',
  'All_brand_v072124.csv',
  'MOH_Code.csv',
  'NHIC_Code.csv',
  'NUPCO_Code.csv',
  'GTIN_Code.csv',
  'Registration_Number_Code.csv'
];

let filesFound = 0;
csvFiles.forEach(file => {
  const filePath = path.join(FILES_DIR, file);
  const exists = fs.existsSync(filePath);
  console.log(`   ${exists ? '✅' : '❌'} ${file} ${exists ? '' : '(NOT FOUND)'}`);
  if (exists) {
    const stats = fs.statSync(filePath);
    console.log(`      Size: ${(stats.size / 1024).toFixed(2)} KB`);
    filesFound++;
  }
});

console.log(`\n   Found ${filesFound}/${csvFiles.length} files`);

// Test 2: Check database connection
console.log('\n2️⃣ Testing database connection...');
try {
  const result = await query('SELECT NOW()');
  console.log('   ✅ Database connected successfully');
  console.log(`   Time: ${result.rows[0].now}`);
} catch (error) {
  console.log('   ❌ Database connection failed:', error.message);
  process.exit(1);
}

// Test 3: Check if tables exist
console.log('\n3️⃣ Checking database tables...');
try {
  const tableCheck = await query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('medicines', 'medicine_brands', 'medicine_codes')
    ORDER BY table_name
  `);
  
  if (tableCheck.rows.length === 3) {
    console.log('   ✅ All required tables exist:');
    tableCheck.rows.forEach(row => {
      console.log(`      - ${row.table_name}`);
    });
  } else {
    console.log('   ⚠️  Missing tables!');
    console.log('   Found:', tableCheck.rows.map(r => r.table_name).join(', '));
    console.log('   You need to run the migration first!');
  }
  
  // Check row counts
  console.log('\n4️⃣ Checking current data...');
  const medicineCount = await query('SELECT COUNT(*) FROM medicines');
  const brandCount = await query('SELECT COUNT(*) FROM medicine_brands');
  const codeCount = await query('SELECT COUNT(*) FROM medicine_codes');
  
  console.log(`   Medicines: ${medicineCount.rows[0].count}`);
  console.log(`   Brands: ${brandCount.rows[0].count}`);
  console.log(`   Codes: ${codeCount.rows[0].count}`);
  
} catch (error) {
  console.log('   ❌ Table check failed:', error.message);
  process.exit(1);
}

// Test 4: Check Ollama connection (needed for embeddings)
console.log('\n5️⃣ Checking Ollama service...');
try {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const response = await fetch(`${ollamaUrl}/api/tags`);
  
  if (response.ok) {
    const data = await response.json();
    console.log('   ✅ Ollama is running');
    console.log(`   Models available: ${data.models?.length || 0}`);
    if (data.models && data.models.length > 0) {
      console.log('   Models:');
      data.models.forEach(model => {
        console.log(`      - ${model.name}`);
      });
    }
  } else {
    console.log('   ⚠️  Ollama responded but with error');
  }
} catch (error) {
  console.log('   ⚠️  Ollama not accessible:', error.message);
  console.log('   Note: Embeddings generation will fail without Ollama!');
  console.log('   Start it with: ollama serve');
}

console.log('\n' + '='.repeat(60));
console.log('✅ Test complete!\n');
process.exit(0);

