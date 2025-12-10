/**
 * Test script for SNOMED code validation
 * Usage: node scripts/testSnomedValidation.js
 */

import ollamaService from '../services/ollamaService.js';

async function testSnomedValidation() {
  console.log('='.repeat(60));
  console.log('SNOMED CODE VALIDATION TEST');
  console.log('='.repeat(60));

  // Test cases
  const testCases = [
    // From your screenshot - should be VALID
    { code: '62315008', description: 'Diarrhea' },
    
    // Common valid codes
    { code: '386661006', description: 'Fever' },
    { code: '25064002', description: 'Headache' },
    { code: '49727002', description: 'Cough' },
    
    // Test with potentially wrong description
    { code: '62315008', description: 'Headache' }, // Wrong - 62315008 is Diarrhea, not Headache
    
    // Test with made-up code
    { code: '99999999', description: 'Some condition' },
  ];

  for (const testCase of testCases) {
    console.log('\n' + '-'.repeat(60));
    console.log(`Testing: ${testCase.code} - "${testCase.description}"`);
    console.log('-'.repeat(60));
    
    try {
      const result = await ollamaService.validateSnomedCode(testCase.code, testCase.description);
      
      console.log('\nResult:');
      console.log(`  Valid: ${result.isValid ? '✅ YES' : '❌ NO'}`);
      console.log(`  Confidence: ${(result.confidence * 100).toFixed(0)}%`);
      console.log(`  Explanation: ${result.explanation || 'N/A'}`);
      
      if (result.correctDescription) {
        console.log(`  Correct Description: ${result.correctDescription}`);
      }
      if (result.suggestedCode) {
        console.log(`  Suggested Code: ${result.suggestedCode}`);
      }
      if (result.suggestedDescription) {
        console.log(`  Suggested Description: ${result.suggestedDescription}`);
      }
      
    } catch (error) {
      console.error(`  Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('\n' + '='.repeat(60));
  console.log('TEST COMPLETE');
  console.log('='.repeat(60));
}

// Run the test
testSnomedValidation().catch(console.error);

