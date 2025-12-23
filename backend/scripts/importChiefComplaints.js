/**
 * Import Chief Complaint SNOMED codes from Excel file
 * 
 * Usage: node scripts/importChiefComplaints.js
 * 
 * Excel file: docs/cheifComplaint8April2025.xlsx
 * Columns: Term, Preferred Term, Concept Id
 */

import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function importChiefComplaints() {
  console.log('🏥 Starting Chief Complaint SNOMED codes import...\n');

  try {
    // Read Excel file
    const excelPath = path.join(__dirname, '../../docs/cheifComplaint8April2025.xlsx');
    console.log(`📁 Reading Excel file: ${excelPath}`);
    
    const workbook = xlsx.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON (skip header row)
    const data = xlsx.utils.sheet_to_json(worksheet, { header: ['term', 'preferredTerm', 'conceptId'] });
    
    // Remove header row
    const codes = data.slice(1).filter(row => row.conceptId && row.preferredTerm);
    
    console.log(`📊 Found ${codes.length} chief complaint codes to import\n`);

    // Get or create the code system
    let codeSystemResult = await query(`
      SELECT code_system_id FROM nphies_code_systems 
      WHERE code = 'chief-complaint-snomed'
    `);

    let codeSystemId;
    
    if (codeSystemResult.rows.length === 0) {
      // Create the code system
      console.log('📝 Creating chief-complaint-snomed code system...');
      const insertResult = await query(`
        INSERT INTO nphies_code_systems (code_system_id, code, name, description, source_url, is_active)
        VALUES (
          gen_random_uuid(),
          'chief-complaint-snomed',
          'Chief Complaint (SNOMED-CT)',
          'SNOMED-CT codes for chief complaints in prior authorizations',
          'http://snomed.info/sct',
          true
        )
        RETURNING code_system_id
      `);
      codeSystemId = insertResult.rows[0].code_system_id;
      console.log(`✅ Code system created with ID: ${codeSystemId}\n`);
    } else {
      codeSystemId = codeSystemResult.rows[0].code_system_id;
      console.log(`✅ Using existing code system ID: ${codeSystemId}\n`);
    }

    // Clear existing codes for this system (to allow re-import)
    const deleteResult = await query(`
      DELETE FROM nphies_codes WHERE code_system_id = $1
    `, [codeSystemId]);
    console.log(`🗑️  Cleared ${deleteResult.rowCount} existing codes\n`);

    // Insert codes
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < codes.length; i++) {
      const row = codes[i];
      const code = String(row.conceptId);
      const displayEn = row.preferredTerm;
      const term = row.term || displayEn;
      
      // Clean the term (remove ≡ symbol and extra whitespace)
      const cleanTerm = term.replace(/^≡\s*/, '').trim();
      
      try {
        await query(`
          INSERT INTO nphies_codes (nphies_code_id, code_system_id, code, display_en, description, is_active, sort_order)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, true, $5)
          ON CONFLICT (code_system_id, code) DO UPDATE SET
            display_en = EXCLUDED.display_en,
            description = EXCLUDED.description,
            sort_order = EXCLUDED.sort_order,
            updated_at = NOW()
        `, [codeSystemId, code, displayEn, cleanTerm, i + 1]);
        
        inserted++;
        
        // Progress indicator every 20 codes
        if (inserted % 20 === 0) {
          console.log(`   Imported ${inserted}/${codes.length} codes...`);
        }
      } catch (err) {
        console.error(`❌ Error inserting code ${code}: ${err.message}`);
        errors++;
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   - Inserted/Updated: ${inserted} codes`);
    console.log(`   - Errors: ${errors}`);
    
    // Verify import
    const countResult = await query(`
      SELECT COUNT(*) as count FROM nphies_codes WHERE code_system_id = $1
    `, [codeSystemId]);
    console.log(`   - Total codes in database: ${countResult.rows[0].count}\n`);

    // Show sample codes
    const sampleResult = await query(`
      SELECT code, display_en FROM nphies_codes 
      WHERE code_system_id = $1 
      ORDER BY sort_order 
      LIMIT 5
    `, [codeSystemId]);
    
    console.log('📋 Sample imported codes:');
    sampleResult.rows.forEach(row => {
      console.log(`   ${row.code} - ${row.display_en}`);
    });

  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  }

  process.exit(0);
}

importChiefComplaints();

