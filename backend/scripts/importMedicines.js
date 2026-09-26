import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, transaction } from '../db.js';
import ragService from '../services/ragService.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to CSV files
const FILES_DIR = path.join(__dirname, '..', '..', 'files');

class MedicineImporter {
  constructor() {
    this.stats = {
      // embeddingFailed: rows skipped because no real embedding could be generated
      medicines: { total: 0, success: 0, errors: 0, embeddingFailed: 0 },
      brands: { total: 0, success: 0, errors: 0 },
      codes: { total: 0, success: 0, errors: 0, skipped: 0 }
    };
    this.maxConsecutiveErrors = 10; // Stop if 10 consecutive errors occur
    this.maxTotalErrors = 100; // Stop if more than 100 total errors
    this.consecutiveErrors = 0;
  }

  /**
   * Parse CSV file and return rows
   */
  parseCSV(filePath) {
    console.log(`\n📄 Reading file: ${filePath}`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('Empty CSV file');
    }

    // Parse header
    const header = lines[0].split(',').map(h => h.trim());
    
    // Parse rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length > 0) {
        const row = {};
        header.forEach((key, index) => {
          row[key] = values[index] || '';
        });
        rows.push(row);
      }
    }

    console.log(`✅ Parsed ${rows.length} rows`);
    return rows;
  }

  /**
   * Parse a single CSV line, handling commas in quoted strings
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    values.push(current.trim());
    return values;
  }

  /**
   * Import generic medicines from All_generic_v072124.csv
   */
  async importGenericMedicines() {
    console.log('\n🔷 STEP 1: Importing Generic Medicines');
    console.log('='.repeat(60));
    
    this.consecutiveErrors = 0; // Reset error counter for this step
    
    const filePath = path.join(FILES_DIR, 'All_generic_v072124.csv');
    const rows = this.parseCSV(filePath);
    
    this.stats.medicines.total = rows.length;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Generate text description for embedding
        const description = `${row['Active Ingredient']} ${row['Strength']} ${row['Unit']} ${row['Dosage Form - Parent']} ${row['Dosage Form - Child']}`.toLowerCase();
        
        // Generate embedding. Without a real embedding the row is skipped and counted:
        // it is never stored with a placeholder vector.
        console.log(`\n[${i + 1}/${rows.length}] Generating embedding for: ${description.substring(0, 60)}...`);
        let embedding;
        try {
          embedding = await ragService.generateEmbedding(description);
        } catch (embeddingError) {
          this.stats.medicines.embeddingFailed++;
          this.consecutiveErrors++;
          console.error(`⚠️  Skipping medicine ${row['MG_MRID']}: ${embeddingError.message}`);
          if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
            throw Object.assign(
              new Error(`Import stopped after ${this.maxConsecutiveErrors} consecutive embedding failures (check OLLAMA_BASE_URL / OLLAMA_EMBED_MODEL)`),
              { fatal: true }
            );
          }
          continue;
        }
        const vectorString = `[${embedding.join(',')}]`;
        
        // Insert medicine
        await query(`
          INSERT INTO medicines (
            mrid, active_ingredient, strength, unit, 
            dosage_form_parent, dosage_form_child, embedding
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7::vector)
          ON CONFLICT (mrid) DO UPDATE SET
            active_ingredient = EXCLUDED.active_ingredient,
            strength = EXCLUDED.strength,
            unit = EXCLUDED.unit,
            dosage_form_parent = EXCLUDED.dosage_form_parent,
            dosage_form_child = EXCLUDED.dosage_form_child,
            embedding = EXCLUDED.embedding
        `, [
          row['MG_MRID'],
          row['Active Ingredient'],
          row['Strength'],
          row['Unit'],
          row['Dosage Form - Parent'],
          row['Dosage Form - Child'],
          vectorString
        ]);
        
        this.stats.medicines.success++;
        this.consecutiveErrors = 0; // Reset consecutive error counter on success
        
        // Progress update every 50 items
        if ((i + 1) % 50 === 0) {
          console.log(`\n📊 Progress: ${i + 1}/${rows.length} medicines imported`);
        }
        
      } catch (error) {
        if (error.fatal) throw error;
        console.error(`❌ Error importing medicine ${row['MG_MRID']}:`, error.message);
        this.stats.medicines.errors++;
        this.consecutiveErrors++;
        
        // Check if we should stop due to too many errors
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          console.error(`\n🛑 STOPPING: ${this.maxConsecutiveErrors} consecutive errors occurred!`);
          console.error(`This usually indicates a schema or data type mismatch.`);
          console.error(`Please fix the issue and restart the import.\n`);
          throw new Error(`Import stopped due to ${this.maxConsecutiveErrors} consecutive errors`);
        }
        
        if (this.stats.medicines.errors >= this.maxTotalErrors) {
          console.error(`\n🛑 STOPPING: More than ${this.maxTotalErrors} total errors!`);
          console.error(`Please review the errors and fix underlying issues.\n`);
          throw new Error(`Import stopped due to ${this.maxTotalErrors} total errors`);
        }
      }
    }
    
    console.log(`\n✅ Generic medicines import complete: ${this.stats.medicines.success}/${this.stats.medicines.total} successful`);
  }

  /**
   * Import brand medicines from All_brand_v072124.csv
   */
  async importBrandMedicines() {
    console.log('\n🔷 STEP 2: Importing Brand Medicines');
    console.log('='.repeat(60));
    
    this.consecutiveErrors = 0; // Reset error counter for this step
    
    const filePath = path.join(FILES_DIR, 'All_brand_v072124.csv');
    const rows = this.parseCSV(filePath);
    
    this.stats.brands.total = rows.length;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        // Extract MRID from MB_MRID (e.g., "010101-0122-6401-01-07" -> "010101-0122-6401")
        const mbMrid = row['MB_MRID'];
        let mrid = row['MG_MRID'] || row['MRID'];
        
        // If MRID not in CSV, extract first 3 parts from MB_MRID
        if (!mrid && mbMrid) {
          const parts = mbMrid.split('-');
          if (parts.length >= 3) {
            mrid = parts.slice(0, 3).join('-');
          }
        }
        
        if (!mrid || !mbMrid) {
          console.warn(`⚠️  Skipping row ${i + 1}: Missing MRID or MB_MRID`);
          this.stats.brands.errors++;
          continue;
        }
        
        // Check if the medicine exists in the medicines table
        const medicineCheck = await query(`
          SELECT 1 FROM medicines WHERE mrid = $1 LIMIT 1
        `, [mrid]);
        
        if (medicineCheck.rows.length === 0) {
          // Skip brands for medicines that don't exist (they may have failed import or not in generic CSV)
          if ((i + 1) % 1000 === 0) {
            console.warn(`⚠️  Skipping brand ${mbMrid}: Medicine ${mrid} not found in database`);
          }
          this.stats.brands.errors++;
          this.consecutiveErrors = 0; // Don't count as consecutive error since it's expected
          continue;
        }
        
        await query(`
          INSERT INTO medicine_brands (mrid, mb_mrid, brand_name, package_form)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (mb_mrid) DO UPDATE SET
            brand_name = EXCLUDED.brand_name,
            package_form = EXCLUDED.package_form
        `, [
          mrid,
          mbMrid,
          row['Brand Name'],
          row['Package Form']
        ]);
        
        this.stats.brands.success++;
        this.consecutiveErrors = 0; // Reset consecutive error counter on success
        
        // Progress update every 500 items
        if ((i + 1) % 500 === 0) {
          console.log(`📊 Progress: ${i + 1}/${rows.length} brands imported`);
        }
        
      } catch (error) {
        console.error(`❌ Error importing brand ${row['MB_MRID']}:`, error.message);
        this.stats.brands.errors++;
        this.consecutiveErrors++;
        
        // Check if we should stop due to too many errors
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          console.error(`\n🛑 STOPPING: ${this.maxConsecutiveErrors} consecutive errors occurred!`);
          console.error(`This usually indicates a schema or data type mismatch.`);
          console.error(`Please fix the issue and restart the import.\n`);
          throw new Error(`Import stopped due to ${this.maxConsecutiveErrors} consecutive errors`);
        }
        
        if (this.stats.brands.errors >= this.maxTotalErrors) {
          console.error(`\n🛑 STOPPING: More than ${this.maxTotalErrors} total errors!`);
          console.error(`Please review the errors and fix underlying issues.\n`);
          throw new Error(`Import stopped due to ${this.maxTotalErrors} total errors`);
        }
      }
    }
    
    console.log(`✅ Brand medicines import complete: ${this.stats.brands.success}/${this.stats.brands.total} successful`);
  }

  /**
   * Import medicine codes
   */
  async importCodes(codeType, fileName, mridColumn, codeColumn) {
    console.log(`\n🔷 Importing ${codeType} Codes`);
    console.log('-'.repeat(60));
    
    this.consecutiveErrors = 0; // Reset error counter for this code type
    
    const filePath = path.join(FILES_DIR, fileName);
    const rows = this.parseCSV(filePath);
    
    let success = 0;
    let errors = 0;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      try {
        let mrid = row[mridColumn];
        
        if (!mrid) {
          // Missing data is a skip, not an error; it must not count towards the error limits.
          this.stats.codes.skipped++;
          continue;
        }
        
        // Extract base MRID (first 3 parts) if it's a brand MRID
        // e.g., "420201-0122-6401-01-04" -> "420201-0122-6401"
        const parts = mrid.split('-');
        if (parts.length > 3) {
          mrid = parts.slice(0, 3).join('-');
        }
        
        // Check if the medicine exists in the medicines table
        const medicineCheck = await query(`
          SELECT 1 FROM medicines WHERE mrid = $1 LIMIT 1
        `, [mrid]);
        
        if (medicineCheck.rows.length === 0) {
          // Skip codes for medicines that don't exist (this is expected, not an error)
          if ((i + 1) % 5000 === 0) {
            console.warn(`⚠️  Skipping ${codeType} code ${row[codeColumn]}: Medicine ${mrid} not found`);
          }
          this.stats.codes.skipped++;
          continue;
        }
        
        await query(`
          INSERT INTO medicine_codes (mrid, code_type, code_value)
          VALUES ($1, $2, $3)
          ON CONFLICT (code_type, code_value) DO NOTHING
        `, [
          mrid,
          codeType,
          row[codeColumn]
        ]);
        
        success++;
        this.stats.codes.success++;
        this.consecutiveErrors = 0; // Reset consecutive error counter on success
        
      } catch (error) {
        console.error(`❌ Error importing ${codeType} code ${row[codeColumn]}:`, error.message);
        errors++;
        this.stats.codes.errors++;
        this.consecutiveErrors++;
        
        // Check if we should stop due to too many errors
        if (this.consecutiveErrors >= this.maxConsecutiveErrors) {
          console.error(`\n🛑 STOPPING: ${this.maxConsecutiveErrors} consecutive errors occurred while importing ${codeType} codes!`);
          console.error(`This usually indicates a schema or data type mismatch.`);
          console.error(`Please fix the issue and restart the import.\n`);
          throw new Error(`Import stopped due to ${this.maxConsecutiveErrors} consecutive errors in ${codeType} codes`);
        }
        
        if (this.stats.codes.errors >= this.maxTotalErrors) {
          console.error(`\n🛑 STOPPING: More than ${this.maxTotalErrors} total code errors!`);
          console.error(`Please review the errors and fix underlying issues.\n`);
          throw new Error(`Import stopped due to ${this.maxTotalErrors} total code errors`);
        }
      }
    }
    
    this.stats.codes.total += rows.length;
    console.log(`✅ ${codeType} codes import complete: ${success}/${rows.length} successful`);
  }

  /**
   * Import all code types
   */
  async importAllCodes() {
    console.log('\n🔷 STEP 3: Importing Medicine Codes');
    console.log('='.repeat(60));
    
    await this.importCodes('MOH', 'MOH_Code.csv', 'MRID', 'moh_code');
    await this.importCodes('NHIC', 'NHIC_Code.csv', 'MRID', 'nhic_code');
    await this.importCodes('NUPCO', 'NUPCO_Code.csv', 'MRID', 'NUPCO Code');
    await this.importCodes('GTIN', 'GTIN_Code.csv', 'MRID', 'GTIN');
    await this.importCodes('REGISTRATION', 'Registration_Number_Code.csv', 'MRID', 'RegisterNumber');
  }

  /**
   * Print final statistics
   */
  printStats() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT STATISTICS');
    console.log('='.repeat(60));
    console.log(`\n🔹 Generic Medicines:`);
    console.log(`   Total: ${this.stats.medicines.total}`);
    console.log(`   Success: ${this.stats.medicines.success}`);
    console.log(`   Errors: ${this.stats.medicines.errors}`);
    console.log(`   Skipped (no embedding): ${this.stats.medicines.embeddingFailed}`);
    
    console.log(`\n🔹 Brand Medicines:`);
    console.log(`   Total: ${this.stats.brands.total}`);
    console.log(`   Success: ${this.stats.brands.success}`);
    console.log(`   Errors: ${this.stats.brands.errors}`);
    
    console.log(`\n🔹 Medicine Codes:`);
    console.log(`   Total: ${this.stats.codes.total}`);
    console.log(`   Success: ${this.stats.codes.success}`);
    console.log(`   Errors: ${this.stats.codes.errors}`);
    console.log(`   Skipped (no matching medicine): ${this.stats.codes.skipped}`);
    
    const totalSuccess = this.stats.medicines.success + this.stats.brands.success + this.stats.codes.success;
    const totalRecords = this.stats.medicines.total + this.stats.brands.total + this.stats.codes.total;
    
    console.log(`\n✅ TOTAL: ${totalSuccess}/${totalRecords} records imported successfully`);
    console.log('='.repeat(60) + '\n');
  }

  /** Non-zero when any medicine was skipped because its embedding could not be generated. */
  exitCode() {
    return this.stats.medicines.embeddingFailed > 0 ? 1 : 0;
  }

  /**
   * Run the full import process
   */
  async run() {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 MEDICINE DATA IMPORT STARTED');
    console.log('='.repeat(60));
    console.log(`📅 Start Time: ${new Date().toISOString()}`);
    console.log(`\n⚙️  Error Handling:`);
    console.log(`   - Will stop after ${this.maxConsecutiveErrors} consecutive errors`);
    console.log(`   - Will stop after ${this.maxTotalErrors} total errors`);
    console.log(`   - This prevents importing bad data due to schema mismatches\n`);
    
    const startTime = Date.now();
    
    try {
      // Step 1: Import generic medicines (with embeddings)
      await this.importGenericMedicines();
      
      // Step 2: Import brand medicines
      await this.importBrandMedicines();
      
      // Step 3: Import all codes
      await this.importAllCodes();
      
      // Print statistics
      this.printStats();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`⏱️  Total Duration: ${duration} seconds`);
      console.log(`📅 End Time: ${new Date().toISOString()}`);
      if (this.exitCode() !== 0) {
        console.error(`\n❌ ${this.stats.medicines.embeddingFailed} medicine(s) were skipped because no embedding could be generated; re-run the import once the embedding model is available.\n`);
      } else {
        console.log('\n✅ Import completed successfully!\n');
      }
      return this.stats;
      
    } catch (error) {
      console.error('\n❌ Import failed:', error);
      throw error;
    }
  }
}

export default MedicineImporter;

