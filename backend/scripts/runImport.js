import MedicineImporter from './importMedicines.js';

console.log('\n🚀 Starting Medicine Import...\n');

const importer = new MedicineImporter();

importer.run()
  .then(() => {
    console.log('\n✅ Import completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error);
    console.error(error.stack);
    process.exit(1);
  });

