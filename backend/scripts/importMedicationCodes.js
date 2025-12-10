/**
 * Import Medication Codes from NPHIES CodeSystem JSON
 * 
 * This script reads the CodeSystem-medication-codes.json file and imports
 * all medication codes into the medication_codes table.
 * 
 * Usage: npm run import-medications
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the JSON file
const jsonFilePath = path.resolve(__dirname, '../../docs/CodeSystem-medication-codes.json');

/**
 * Extract property value from medication concept
 */
function getProperty(properties, code, valueType = 'valueString') {
  if (!properties) return null;
  const prop = properties.find(p => p.code === code);
  if (!prop) return null;
  
  // Try different value types
  if (prop[valueType] !== undefined) return prop[valueType];
  if (prop.valueString !== undefined) return prop.valueString;
  if (prop.valueDecimal !== undefined) return prop.valueDecimal;
  if (prop.valueInteger !== undefined) return prop.valueInteger;
  if (prop.valueBoolean !== undefined) return prop.valueBoolean;
  
  return null;
}

/**
 * Parse medication concept into database record
 */
function parseMedication(concept) {
  const props = concept.property || [];
  
  return {
    code: concept.code,
    display: concept.display || null,
    strength: getProperty(props, 'strength'),
    generic_name: getProperty(props, 'genericName'),
    route_of_administration: getProperty(props, 'roa'),
    dosage_form: getProperty(props, 'dosageForm'),
    package_size: getProperty(props, 'packageSize'),
    unit_type: getProperty(props, 'unitType'),
    price: getProperty(props, 'price', 'valueDecimal'),
    ingredients: getProperty(props, 'ingredients'),
    atc_code: getProperty(props, 'atcCode'),
    is_controlled: getProperty(props, 'isControlled') === 'Y',
    reg_owner: getProperty(props, 'regOwner')
  };
}

/**
 * Escape single quotes for SQL
 */
function escapeSql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value;
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Main import function
 */
async function importMedicationCodes() {
  console.log('🔄 Starting medication codes import...');
  console.log(`📂 Reading from: ${jsonFilePath}`);
  
  try {
    // Check if file exists
    if (!fs.existsSync(jsonFilePath)) {
      throw new Error(`JSON file not found: ${jsonFilePath}`);
    }
    
    // Read and parse JSON file
    const fileContent = fs.readFileSync(jsonFilePath, 'utf8');
    const codeSystem = JSON.parse(fileContent);
    
    console.log(`📊 CodeSystem: ${codeSystem.name}`);
    console.log(`📊 Title: ${codeSystem.title}`);
    console.log(`📊 Total concepts: ${codeSystem.concept?.length || 0}`);
    
    if (!codeSystem.concept || codeSystem.concept.length === 0) {
      throw new Error('No medication concepts found in JSON file');
    }
    
    // Parse all medications
    const medications = [];
    let skipped = 0;
    
    for (const concept of codeSystem.concept) {
      if (!concept.code) {
        skipped++;
        continue;
      }
      
      const med = parseMedication(concept);
      medications.push(med);
    }
    
    console.log(`\n✅ Parsed ${medications.length} medications`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped ${skipped} concepts without code`);
    }
    
    // Show sample
    console.log('\n📋 Sample medications:');
    medications.slice(0, 5).forEach((med, i) => {
      console.log(`  ${i + 1}. ${med.code} - ${med.display || 'No name'}`);
    });
    
    // Clear existing data
    console.log('\n🗑️  Clearing existing medication codes...');
    await query('TRUNCATE TABLE medication_codes RESTART IDENTITY CASCADE');
    
    // Batch insert
    const batchSize = 100;
    let inserted = 0;
    
    console.log(`\n📥 Inserting ${medications.length} medications in batches of ${batchSize}...`);
    
    for (let i = 0; i < medications.length; i += batchSize) {
      const batch = medications.slice(i, i + batchSize);
      
      const values = batch.map(med => `(
        ${escapeSql(med.code)},
        ${escapeSql(med.display)},
        ${escapeSql(med.strength)},
        ${escapeSql(med.generic_name)},
        ${escapeSql(med.route_of_administration)},
        ${escapeSql(med.dosage_form)},
        ${escapeSql(med.package_size)},
        ${escapeSql(med.unit_type)},
        ${escapeSql(med.price)},
        ${escapeSql(med.ingredients)},
        ${escapeSql(med.atc_code)},
        ${escapeSql(med.is_controlled)},
        ${escapeSql(med.reg_owner)}
      )`).join(',\n');
      
      await query(`
        INSERT INTO medication_codes (
          code, display, strength, generic_name, route_of_administration,
          dosage_form, package_size, unit_type, price, ingredients,
          atc_code, is_controlled, reg_owner
        ) VALUES ${values}
        ON CONFLICT (code) DO UPDATE SET
          display = EXCLUDED.display,
          strength = EXCLUDED.strength,
          generic_name = EXCLUDED.generic_name,
          route_of_administration = EXCLUDED.route_of_administration,
          dosage_form = EXCLUDED.dosage_form,
          package_size = EXCLUDED.package_size,
          unit_type = EXCLUDED.unit_type,
          price = EXCLUDED.price,
          ingredients = EXCLUDED.ingredients,
          atc_code = EXCLUDED.atc_code,
          is_controlled = EXCLUDED.is_controlled,
          reg_owner = EXCLUDED.reg_owner,
          updated_at = NOW()
      `);
      
      inserted += batch.length;
      const progress = Math.round((inserted / medications.length) * 100);
      process.stdout.write(`\r   Progress: ${inserted}/${medications.length} (${progress}%)`);
    }
    
    console.log('\n');
    
    // Verify import
    const countResult = await query('SELECT COUNT(*) as count FROM medication_codes');
    const finalCount = parseInt(countResult.rows[0].count);
    
    // Get breakdown stats
    const statsResult = await query(`
      SELECT 
        COUNT(*) as total,
        COUNT(display) as with_display,
        COUNT(strength) as with_strength,
        COUNT(generic_name) as with_generic,
        COUNT(price) as with_price,
        COUNT(CASE WHEN is_controlled THEN 1 END) as controlled
      FROM medication_codes
    `);
    const stats = statsResult.rows[0];
    
    console.log('✅ Import completed successfully!');
    console.log('\n📊 Statistics:');
    console.log(`   Total medications: ${stats.total}`);
    console.log(`   With display name: ${stats.with_display}`);
    console.log(`   With strength: ${stats.with_strength}`);
    console.log(`   With generic name: ${stats.with_generic}`);
    console.log(`   With price: ${stats.with_price}`);
    console.log(`   Controlled substances: ${stats.controlled}`);
    
  } catch (error) {
    console.error('\n❌ Error importing medication codes:', error.message);
    if (error.code === '42P01') {
      console.error('\n⚠️  The medication_codes table does not exist.');
      console.error('   Please run the migration first:');
      console.error('   psql -f backend/migrations/create_medication_codes_table.sql');
    }
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the import
importMedicationCodes();

