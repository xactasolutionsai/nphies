// LEGACY / DESTRUCTIVE: this faker seed targets the old schema.sql layout (e.g. eligibility_requests,
// claim_batches with integer keys, 'Male'/'Female' genders, a `name`/`first_name` split) which does not
// match the current database, so its inserts are expected to fail after the TRUNCATE. It is kept for
// reference only. It runs only when executed directly, never in production, and only with
// ALLOW_DESTRUCTIVE_SEED=true (see scripts/seedGuard.js).
import { faker } from '@faker-js/faker';
import dotenv from 'dotenv';
import { assertDestructiveSeedAllowed, isMainModule } from './scripts/seedGuard.js';

// Load environment variables
dotenv.config();

// Database connection (db.js requires DB_NAME, DB_USER and DB_PASSWORD; no credential defaults)
const { default: pool } = await import('./db.js');

// Configuration for data generation
const CONFIG = {
  patients: 50,
  providers: 10,
  insurers: 5,
  authorizations: 100,
  eligibilityRequests: 80,
  claims: 200,
  claimBatches: 10,
  payments: 100,
};

// NPHIES-specific codes and rules
const NPHIES_CODES = {
  coverageTypes: ['C10', 'C20', 'C30', 'C40', 'C50'], // Site eligibility codes
  serviceTypes: ['S001', 'S002', 'S003', 'S004', 'S005'], // Service type codes
  policyPrefixes: ['POL', 'POL-HEALTH', 'POL-FAMILY', 'POL-INDIVIDUAL'],
  statusCodes: {
    auth: ['approved', 'denied', 'pending', 'under_review'],
    eligibility: ['active', 'inactive', 'pending', 'expired'],
    claim: ['submitted', 'adjudicated', 'denied', 'paid', 'pending'],
    batch: ['sent', 'processed', 'failed', 'pending'],
    payment: ['completed', 'pending', 'failed', 'processing']
  }
};

// Arabic names for more realistic data
const ARABIC_NAMES = {
  firstNames: [
    'أحمد', 'محمد', 'عبدالله', 'عبدالرحمن', 'خالد', 'سعد', 'عمر', 'يوسف', 'إبراهيم', 'حسن',
    'فاطمة', 'عائشة', 'خديجة', 'مريم', 'زينب', 'نور', 'سارة', 'هند', 'ريم', 'نورا'
  ],
  lastNames: [
    'العلي', 'السعد', 'القحطاني', 'الغامدي', 'الزهراني', 'البقمي', 'العتيبي', 'الرشيد', 'المطيري', 'الشمري',
    'الحربي', 'النجدي', 'الخالدي', 'الراشد', 'الفهيد', 'المنصور', 'السلطان', 'الملك', 'الأمير', 'الشيخ'
  ]
};

// Helper functions
const generateUUID = () => faker.string.uuid();
const generateNPHIESId = (prefix, count) => `${prefix}-${String(count).padStart(5, '0')}`;
const randomChoice = (array) => array[Math.floor(Math.random() * array.length)];
const randomBoolean = (probability = 0.5) => Math.random() < probability;

// Generate Arabic name
const generateArabicName = () => {
  const firstName = randomChoice(ARABIC_NAMES.firstNames);
  const lastName = randomChoice(ARABIC_NAMES.lastNames);
  return { firstName, lastName };
};

// Generate realistic Saudi phone number
const generateSaudiPhone = () => {
  const prefixes = ['50', '51', '52', '53', '54', '55', '56', '57', '58', '59'];
  const prefix = randomChoice(prefixes);
  const number = faker.string.numeric(7);
  return `+966${prefix}${number}`;
};

// Generate Saudi address
const generateSaudiAddress = () => {
  const cities = ['الرياض', 'جدة', 'الدمام', 'مكة المكرمة', 'المدينة المنورة', 'الطائف', 'بريدة', 'تبوك', 'خميس مشيط', 'الهفوف'];
  const city = randomChoice(cities);
  const district = faker.location.streetAddress();
  return `${district}, ${city}, المملكة العربية السعودية`;
};

// Generate policy number
const generatePolicyNumber = () => {
  const prefix = randomChoice(NPHIES_CODES.policyPrefixes);
  const year = faker.date.recent().getFullYear();
  const number = faker.string.alphanumeric(8).toUpperCase();
  return `${prefix}-${year}-${number}`;
};

// Data generation functions
const generatePatients = (count) => {
  const patients = [];
  for (let i = 1; i <= count; i++) {
    const { firstName, lastName } = generateArabicName();
    const birthDate = faker.date.birthdate({ min: 0, max: 80, mode: 'age' });
    const isNewborn = (Date.now() - birthDate.getTime()) < (30 * 24 * 60 * 60 * 1000); // 30 days
    
    patients.push({
      patient_id: generateUUID(),
      nphies_id: generateNPHIESId('PAT', i),
      first_name: firstName,
      last_name: lastName,
      gender: randomChoice(['Male', 'Female']),
      date_of_birth: birthDate.toISOString().split('T')[0],
      newborn_flag: isNewborn,
      transfer_flag: randomBoolean(0.1), // 10% chance
      phone: generateSaudiPhone(),
      email: faker.internet.email({ firstName, lastName }),
      address: generateSaudiAddress(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return patients;
};

const generateProviders = (count) => {
  const providers = [];
  const providerTypes = ['clinic', 'hospital', 'dental_center', 'pharmacy', 'laboratory'];
  
  for (let i = 1; i <= count; i++) {
    const { firstName, lastName } = generateArabicName();
    const type = randomChoice(providerTypes);
    const name = type === 'hospital' 
      ? `مستشفى ${firstName} ${lastName}`
      : type === 'clinic'
      ? `عيادة د. ${firstName} ${lastName}`
      : `مركز ${firstName} ${lastName}`;
    
    providers.push({
      provider_id: generateUUID(),
      nphies_id: generateNPHIESId('PROV', i),
      name: name,
      type: type,
      address: generateSaudiAddress(),
      phone: generateSaudiPhone(),
      email: faker.internet.email(),
      contact_person: `د. ${firstName} ${lastName}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return providers;
};

const generateInsurers = (count) => {
  const insurers = [];
  const insurerNames = [
    'التأمين الصحي السعودي',
    'بوبا العربية للتأمين',
    'تأمين مدجلف',
    'تأمين التعاونية',
    'تأمين الأهلي',
    'تأمين الراجحي',
    'تأمين ساب',
    'تأمين الإنماء'
  ];
  
  for (let i = 1; i <= count; i++) {
    const name = i <= insurerNames.length ? insurerNames[i-1] : `شركة تأمين ${i}`;
    
    insurers.push({
      insurer_id: generateUUID(),
      nphies_id: generateNPHIESId('INS', i),
      name: name,
      status: randomChoice(['Active', 'Inactive', 'Suspended']),
      contact_person: faker.person.fullName(),
      phone: generateSaudiPhone(),
      email: faker.internet.email(),
      address: generateSaudiAddress(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return insurers;
};

const generateAuthorizations = (count, patients, providers, insurers) => {
  const authorizations = [];
  const purposes = ['Surgery', 'Consultation', 'Emergency', 'Dental Treatment', 'Laboratory', 'Radiology', 'Pharmacy'];
  
  for (let i = 1; i <= count; i++) {
    const patient = randomChoice(patients);
    const provider = randomChoice(providers);
    const insurer = randomChoice(insurers);
    const requestDate = faker.date.recent({ days: 30 });
    const serviceStartDate = faker.date.future({ days: 30, refDate: requestDate });
    
    authorizations.push({
      authorization_id: generateUUID(),
      patient_id: patient.patient_id,
      provider_id: provider.provider_id,
      insurer_id: insurer.insurer_id,
      request_date: requestDate.toISOString(),
      service_start_date: serviceStartDate.toISOString(),
      auth_status: randomChoice(NPHIES_CODES.statusCodes.auth),
      auth_number: `AUTH-${faker.string.alphanumeric(8).toUpperCase()}`,
      purpose: randomChoice(purposes),
      amount: faker.number.float({ min: 100, max: 50000, fractionDigits: 2 }),
      notes: faker.lorem.sentence(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return authorizations;
};

const generateEligibilityRequests = (count, patients, providers, insurers) => {
  const eligibilityRequests = [];
  const purposes = ['benefits', 'coverage', 'benefits,coverage'];
  
  for (let i = 1; i <= count; i++) {
    const patient = randomChoice(patients);
    const provider = randomChoice(providers);
    const insurer = randomChoice(insurers);
    const requestDate = faker.date.recent({ days: 30 });
    
    eligibilityRequests.push({
      eligibility_request_id: generateUUID(),
      patient_id: patient.patient_id,
      provider_id: provider.provider_id,
      insurer_id: insurer.insurer_id,
      request_date: requestDate.toISOString(),
      request_purpose: randomChoice(purposes),
      response_status: randomChoice(NPHIES_CODES.statusCodes.eligibility),
      coverage_code: randomChoice(NPHIES_CODES.coverageTypes),
      service_code: randomChoice(NPHIES_CODES.serviceTypes),
      policy_number: generatePolicyNumber(),
      notes: faker.lorem.sentence(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return eligibilityRequests;
};

const generateClaims = (count, patients, providers, insurers, authorizations) => {
  const claims = [];
  const serviceTypes = ['Consultation', 'Surgery', 'Laboratory', 'Radiology', 'Pharmacy', 'Emergency'];
  
  for (let i = 1; i <= count; i++) {
    const patient = randomChoice(patients);
    const provider = randomChoice(providers);
    const insurer = randomChoice(insurers);
    const authorization = randomBoolean(0.7) ? randomChoice(authorizations) : null; // 70% have authorization
    const serviceDate = faker.date.recent({ days: 60 });
    
    claims.push({
      claim_id: generateUUID(),
      claim_number: `CLM-${faker.string.alphanumeric(10).toUpperCase()}`,
      patient_id: patient.patient_id,
      provider_id: provider.provider_id,
      insurer_id: insurer.insurer_id,
      authorization_id: authorization ? authorization.authorization_id : null,
      service_date: serviceDate.toISOString(),
      claim_status: randomChoice(NPHIES_CODES.statusCodes.claim),
      service_type: randomChoice(serviceTypes),
      amount: faker.number.float({ min: 50, max: 25000, fractionDigits: 2 }),
      description: faker.lorem.sentence(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return claims;
};

const generateClaimBatches = (count, claims) => {
  const claimBatches = [];
  const claimsPerBatch = Math.floor(claims.length / count);
  
  for (let i = 1; i <= count; i++) {
    const submissionDate = faker.date.recent({ days: 15 });
    const batchClaims = claims.slice((i-1) * claimsPerBatch, i * claimsPerBatch);
    const totalAmount = batchClaims.reduce((sum, claim) => sum + claim.amount, 0);
    
    claimBatches.push({
      claims_batch_id: generateUUID(),
      batch_identifier: `BATCH-${faker.string.alphanumeric(8).toUpperCase()}`,
      submission_date: submissionDate.toISOString(),
      status: randomChoice(NPHIES_CODES.statusCodes.batch),
      total_amount: totalAmount,
      claim_count: batchClaims.length,
      description: `Batch ${i} containing ${batchClaims.length} claims`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return claimBatches;
};

const generatePayments = (count, claims, providers, insurers) => {
  const payments = [];
  
  for (let i = 1; i <= count; i++) {
    const claim = randomChoice(claims);
    const provider = providers.find(p => p.provider_id === claim.provider_id);
    const insurer = insurers.find(ins => ins.insurer_id === claim.insurer_id);
    const paymentDate = faker.date.recent({ days: 30 });
    
    payments.push({
      payment_id: generateUUID(),
      payment_ref_number: `PAY-${faker.string.alphanumeric(10).toUpperCase()}`,
      claim_id: claim.claim_id,
      provider_id: provider.provider_id,
      insurer_id: insurer.insurer_id,
      payment_date: paymentDate.toISOString(),
      total_paid_amount: faker.number.float({ min: claim.amount * 0.8, max: claim.amount * 1.2, fractionDigits: 2 }),
      payment_status: randomChoice(NPHIES_CODES.statusCodes.payment),
      payment_method: randomChoice(['Bank Transfer', 'Check', 'Wire Transfer', 'ACH']),
      description: `Payment for claim ${claim.claim_number}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
  }
  return payments;
};

// Database operations
const truncateTables = async () => {
  const client = await pool.connect();
  try {
    console.log('🗑️  Truncating tables...');
    
    const tables = [
      'payments', 'claims', 'claim_batches', 'eligibility_requests', 
      'authorizations', 'patients', 'providers', 'insurers'
    ];
    
    for (const table of tables) {
      await client.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE`);
      console.log(`   ✅ Truncated ${table}`);
    }
    
    console.log('✅ All tables truncated successfully');
  } catch (error) {
    console.error('❌ Error truncating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

const insertData = async (tableName, data, columns) => {
  const client = await pool.connect();
  try {
    if (data.length === 0) return;
    
    const placeholders = data.map((_, index) => {
      const start = index * columns.length + 1;
      return `(${columns.map((_, colIndex) => `$${start + colIndex}`).join(', ')})`;
    }).join(', ');
    
    const query = `
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES ${placeholders}
    `;
    
    const values = data.flatMap(row => columns.map(col => row[col]));
    
    await client.query(query, values);
    console.log(`   ✅ Inserted ${data.length} records into ${tableName}`);
  } catch (error) {
    console.error(`❌ Error inserting into ${tableName}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

// Main seeding function
const seedDatabase = async () => {
  const client = await pool.connect();
  try {
    console.log('🌱 Starting database seeding...');
    console.log(`📊 Configuration:`, CONFIG);
    
    // Truncate all tables
    await truncateTables();
    
    // Generate data
    console.log('\n📝 Generating data...');
    const patients = generatePatients(CONFIG.patients);
    const providers = generateProviders(CONFIG.providers);
    const insurers = generateInsurers(CONFIG.insurers);
    const authorizations = generateAuthorizations(CONFIG.authorizations, patients, providers, insurers);
    const eligibilityRequests = generateEligibilityRequests(CONFIG.eligibilityRequests, patients, providers, insurers);
    const claims = generateClaims(CONFIG.claims, patients, providers, insurers, authorizations);
    const claimBatches = generateClaimBatches(CONFIG.claimBatches, claims);
    const payments = generatePayments(CONFIG.payments, claims, providers, insurers);
    
    // Insert data
    console.log('\n💾 Inserting data...');
    await insertData('patients', patients, [
      'patient_id', 'nphies_id', 'first_name', 'last_name', 'gender', 
      'date_of_birth', 'newborn_flag', 'transfer_flag', 'phone', 'email', 
      'address', 'created_at', 'updated_at'
    ]);
    
    await insertData('providers', providers, [
      'provider_id', 'nphies_id', 'name', 'type', 'address', 'phone', 
      'email', 'contact_person', 'created_at', 'updated_at'
    ]);
    
    await insertData('insurers', insurers, [
      'insurer_id', 'nphies_id', 'name', 'status', 'contact_person', 
      'phone', 'email', 'address', 'created_at', 'updated_at'
    ]);
    
    await insertData('authorizations', authorizations, [
      'authorization_id', 'patient_id', 'provider_id', 'insurer_id', 
      'request_date', 'service_start_date', 'auth_status', 'auth_number', 
      'purpose', 'amount', 'notes', 'created_at', 'updated_at'
    ]);
    
    await insertData('eligibility_requests', eligibilityRequests, [
      'eligibility_request_id', 'patient_id', 'provider_id', 'insurer_id', 
      'request_date', 'request_purpose', 'response_status', 'coverage_code', 
      'service_code', 'policy_number', 'notes', 'created_at', 'updated_at'
    ]);
    
    await insertData('claims', claims, [
      'claim_id', 'claim_number', 'patient_id', 'provider_id', 'insurer_id', 
      'authorization_id', 'service_date', 'claim_status', 'service_type', 
      'amount', 'description', 'created_at', 'updated_at'
    ]);
    
    await insertData('claim_batches', claimBatches, [
      'claims_batch_id', 'batch_identifier', 'submission_date', 'status', 
      'total_amount', 'claim_count', 'description', 'created_at', 'updated_at'
    ]);
    
    await insertData('payments', payments, [
      'payment_id', 'payment_ref_number', 'claim_id', 'provider_id', 'insurer_id', 
      'payment_date', 'total_paid_amount', 'payment_status', 'payment_method', 
      'description', 'created_at', 'updated_at'
    ]);
    
    // Summary
    console.log('\n📊 Seeding Summary:');
    console.log(`   👥 Patients: ${patients.length}`);
    console.log(`   🏥 Providers: ${providers.length}`);
    console.log(`   🛡️  Insurers: ${insurers.length}`);
    console.log(`   📋 Authorizations: ${authorizations.length}`);
    console.log(`   ✅ Eligibility Requests: ${eligibilityRequests.length}`);
    console.log(`   📄 Claims: ${claims.length}`);
    console.log(`   📦 Claim Batches: ${claimBatches.length}`);
    console.log(`   💰 Payments: ${payments.length}`);
    
    console.log('\n🎉 Database seeding completed successfully!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

// Run the seeding
if (isMainModule(import.meta.url)) {
  assertDestructiveSeedAllowed();
  seedDatabase()
    .then(() => {
      console.log('✅ Seeding process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Seeding process failed:', error);
      process.exit(1);
    });
}

export { seedDatabase };
