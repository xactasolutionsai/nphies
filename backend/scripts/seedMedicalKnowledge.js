import ragService from '../services/ragService.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Outcome of storing `total` entries of which `stored` got a real embedding. Entries
 * whose embedding failed are skipped (never stored with a placeholder vector), and any
 * skipped entry makes the run fail with a non-zero exit code.
 */
export function embeddingRunSummary(total, stored) {
  const failed = total - stored;
  if (failed <= 0) return { failed: 0, exitCode: 0, message: `All ${total} entries stored with embeddings` };
  return {
    failed,
    exitCode: 1,
    message: `${failed} of ${total} entries were skipped because no embedding could be generated ` +
      '(check OLLAMA_BASE_URL, OLLAMA_EMBED_MODEL and EMBEDDING_DIM); nothing was stored for them'
  };
}

/**
 * Seed the medical knowledge database with ophthalmology guidelines
 */
async function seedMedicalKnowledge() {
  console.log('🌱 Starting medical knowledge seeding process...\n');

  try {
    // Load guidelines from JSON file
    const guidelinesPath = join(__dirname, '../data/medical_guidelines/ophthalmology_guidelines.json');
    console.log(`📂 Loading guidelines from: ${guidelinesPath}`);
    
    const guidelinesData = readFileSync(guidelinesPath, 'utf8');
    const guidelines = JSON.parse(guidelinesData);
    
    console.log(`📋 Loaded ${guidelines.length} guidelines\n`);

    // Check current knowledge base statistics
    console.log('📊 Current knowledge base statistics:');
    const beforeStats = await ragService.getStatistics();
    console.log(`   Total entries: ${beforeStats.totalEntries}`);
    console.log(`   Categories: ${JSON.stringify(beforeStats.categories)}\n`);

    // Ask if user wants to proceed
    if (beforeStats.totalEntries > 0) {
      console.log('⚠️  Warning: Knowledge base already contains data.');
      console.log('   This will add new entries without removing existing ones.\n');
    }

    // Store guidelines in batch
    console.log('💾 Storing guidelines with embeddings...\n');
    const results = await ragService.storeBatchKnowledge(guidelines);

    // Show results
    const summary = embeddingRunSummary(guidelines.length, results.length);
    console.log('\n✅ Seeding finished');
    console.log(`   Successfully stored: ${results.length}/${guidelines.length} guidelines\n`);

    // Show updated statistics
    console.log('📊 Updated knowledge base statistics:');
    const afterStats = await ragService.getStatistics();
    console.log(`   Total entries: ${afterStats.totalEntries}`);
    console.log(`   Categories: ${JSON.stringify(afterStats.categories)}`);
    
    // Show sample entries
    if (results.length > 0) {
      console.log('\n📝 Sample stored entries:');
      results.slice(0, 3).forEach((entry, idx) => {
        console.log(`\n   ${idx + 1}. ID: ${entry.id}`);
        console.log(`      Category: ${entry.category}`);
        console.log(`      Content: ${entry.content.substring(0, 80)}...`);
        console.log(`      Metadata: ${JSON.stringify(entry.metadata)}`);
      });
    }

    if (summary.exitCode !== 0) {
      console.error(`\n❌ ${summary.message}`);
      process.exit(summary.exitCode);
    }
    console.log('\n🎉 Medical knowledge seeding completed successfully!');
    return summary;

  } catch (error) {
    console.error('\n❌ Error during seeding:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Test the seeded knowledge with sample queries
 */
async function testKnowledgeRetrieval() {
  console.log('\n🧪 Testing knowledge retrieval...\n');

  const testQueries = [
    'myopia correction prescription',
    'presbyopia bifocal lenses',
    'diabetic retinopathy screening',
    'astigmatism cylinder axis',
    'contact lens fitting'
  ];

  for (const query of testQueries) {
    console.log(`🔍 Query: "${query}"`);
    const results = await ragService.searchKnowledge(query, 3);
    
    if (results.length > 0) {
      console.log(`   Found ${results.length} relevant guidelines:`);
      results.forEach((result, idx) => {
        console.log(`   ${idx + 1}. [Similarity: ${result.similarity.toFixed(2)}] ${result.content.substring(0, 60)}...`);
      });
    } else {
      console.log('   No results found');
    }
    console.log('');
  }
}

/**
 * Add custom medical knowledge entry
 */
async function addCustomKnowledge() {
  const customGuidelines = [
    {
      content: "For patients presenting with chief complaints of blurred vision and significant signs of refractive error, a comprehensive refraction is essential. This includes both objective (retinoscopy) and subjective refraction methods to determine the most accurate prescription.",
      category: "ophthalmology",
      metadata: {
        title: "Comprehensive Refraction Protocol",
        source: "Clinical Best Practices",
        tags: ["refraction", "examination", "blurred vision"]
      }
    },
    {
      content: "When the duration of illness is less than 7 days with sudden onset of vision changes, rule out acute conditions such as retinal detachment, vitreous hemorrhage, or acute angle-closure glaucoma before prescribing corrective lenses.",
      category: "ophthalmology",
      metadata: {
        title: "Acute Vision Changes Protocol",
        source: "Emergency Eye Care Guidelines",
        tags: ["acute", "emergency", "differential diagnosis"]
      }
    }
  ];

  console.log('\n➕ Adding custom knowledge entries...\n');
  const results = await ragService.storeBatchKnowledge(customGuidelines);
  console.log(`✅ Added ${results.length} custom guidelines\n`);
  const summary = embeddingRunSummary(customGuidelines.length, results.length);
  if (summary.exitCode !== 0) {
    console.error(`❌ ${summary.message}`);
    process.exit(summary.exitCode);
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'seed';

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   Medical Knowledge Database Seeder');
  console.log('   Ophthalmology Guidelines with RAG Support');
  console.log('═══════════════════════════════════════════════════════════\n');

  switch (command) {
    case 'seed':
      await seedMedicalKnowledge();
      process.exit(0);
      break;
      
    case 'test':
      await testKnowledgeRetrieval();
      process.exit(0);
      break;
      
    case 'add-custom':
      await addCustomKnowledge();
      process.exit(0);
      break;
      
    case 'stats':
      const stats = await ragService.getStatistics();
      console.log('📊 Knowledge Base Statistics:');
      console.log(JSON.stringify(stats, null, 2));
      process.exit(0);
      break;
      
    case 'full':
      await seedMedicalKnowledge();
      await addCustomKnowledge();
      await testKnowledgeRetrieval();
      process.exit(0);
      break;
      
    default:
      console.log('Usage: node seedMedicalKnowledge.js [command]');
      console.log('\nCommands:');
      console.log('  seed        - Seed database with ophthalmology guidelines (default)');
      console.log('  test        - Test knowledge retrieval with sample queries');
      console.log('  add-custom  - Add additional custom guidelines');
      console.log('  stats       - Show knowledge base statistics');
      console.log('  full        - Run all commands in sequence');
      process.exit(0);
  }
}

// Run the main function (only when executed directly, so the helpers can be imported)
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

