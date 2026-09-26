import MedicineImporter from './importMedicines.js';

console.log('\n🚀 Starting Medicine Import...\n');

const importer = new MedicineImporter();

importer.run()
  .then(() => {
    // Rows skipped for a missing embedding make the run fail (see importer.exitCode()).
    const code = importer.exitCode();
    if (code === 0) console.log('\n✅ Import completed successfully!');
    else console.error(`\n❌ Import finished with ${importer.stats.medicines.embeddingFailed} medicine(s) skipped (no embedding)`);
    process.exit(code);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    console.error(error.stack);
    process.exit(1);
  });

