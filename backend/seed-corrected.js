import { faker } from '@faker-js/faker';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'nafes_healthcare',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

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

// Data generation functions for existing schema
const generatePatients = (count) => {
  const patients = [];
  for (let i = 1; i <= count; i++) {
    const { firstName, lastName } = generateArabicName();
    const birthDate = faker.date.birthdate({ min: 0, max: 80, mode: 'age' });
    
    patients.push({
      name: `${firstName} ${lastName}`,
      identifier: `PAT-${String(i).padStart(5, '0')}`,
      gender: randomChoice(['Male', 'Female']),
      birth_date: birthDate.toISOString().split('T')[0],
      phone: generateSaudiPhone(),
      email: faker.internet.email({ firstName, lastName }),
      address: generateSaudiAddress()
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
      name: name,
      type: type,
      nphies_id: `PROV-${String(i).padStart(5, '0')}`,
      address: generateSaudiAddress(),
      phone: generateSaudiPhone(),
      email: faker.internet.email(),
      contact_person: `د. ${firstName} ${lastName}`
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
      name: name,
      nphies_id: `INS-${String(i).padStart(5, '0')}`,
      status: randomChoice(['Active', 'Inactive', 'Suspended']),
      contact_person: faker.person.fullName(),
      phone: generateSaudiPhone(),
      email: faker.internet.email(),
      address: generateSaudiAddress()
    });
  }
  return insurers;
};

const generateAuthorizations = (count, patients, providers, insurers) => {
  const authorizations = [];
  const purposes = ['Surgery', 'Consultation', 'Emergency', 'Dental Treatment', 'Laboratory', 'Radiology', 'Pharmacy'];
  const statuses = ['Approved', 'Pending', 'Rejected', 'Under Review'];
  
  for (let i = 1; i <= count; i++) {
    const patient = randomChoice(patients);
    const provider = randomChoice(providers);
    const insurer = randomChoice(insurers);
    const requestDate = faker.date.recent({ days: 30 });
    const approvalDate = faker.date.future({ days: 30, refDate: requestDate });
    
    authorizations.push({
      patient_id: patient.id,
      provider_id: provider.id,
      insurer_id: insurer.id,
      request_date: requestDate.toISOString(),
      approval_date: approvalDate.toISOString(),
      status: randomChoice(statuses),
      purpose: randomChoice(purposes),
      amount: faker.number.float({ min: 100, max: 50000, fractionDigits: 2 }),
      notes: faker.lorem.sentence()
    });
  }
  return authorizations;
};

const generateEligibilityRequests = (count, patients, providers, insurers) => {
  const eligibilityRequests = [];
  const purposes = ['benefits', 'coverage', 'benefits,coverage'];
  const statuses = ['Eligible', 'Not Eligible', 'Pending', 'Under Review'];
  const coverageTypes = ['C10', 'C20', 'C30', 'C40', 'C50'];
  
  for (let i = 1; i <= count; i++) {
    const patient = randomChoice(patients);
    const provider = randomChoice(providers);
    const insurer = randomChoice(insurers);
    const requestDate = faker.date.recent({ days: 30 });
    const responseDate = faker.date.future({ days: 30, refDate: requestDate });
    
    eligibilityRequests.push({
      patient_id: patient.id,
      provider_id: provider.id,
      insurer_id: insurer.id,
      request_date: requestDate.toISOString(),
      response_date: responseDate.toISOString(),
      purpose: randomChoice(purposes),
      status: randomChoice(statuses),
      coverage: randomChoice(coverageTypes),
      notes: faker.lorem.sentence()
    });
  }
  return eligibilityRequests;
};

const generateClaims = (count, patients, providers, insurers, authorizations) => {
  const claims = [];
  const statuses = ['Approved', 'Pending', 'Rejected', 'Under Review'];
  
  for (let i = 1; i <= count; i++) {
    const patient = randomChoice(patients);
    const provider = randomChoice(providers);
    const insurer = randomChoice(insurers);
    const authorization = randomBoolean(0.7) ? randomChoice(authorizations) : null; // 70% have authorization
    const submissionDate = faker.date.recent({ days: 60 });
    const processedDate = faker.date.future({ days: 30, refDate: submissionDate });
    
    claims.push({
      claim_number: `CLM-${faker.string.alphanumeric(10).toUpperCase()}`,
      patient_id: patient.id,
      provider_id: provider.id,
      insurer_id: insurer.id,
      authorization_id: authorization ? authorization.id : null,
      submission_date: submissionDate.toISOString(),
      processed_date: processedDate.toISOString(),
      status: randomChoice(statuses),
      amount: faker.number.float({ min: 50, max: 25000, fractionDigits: 2 }),
      description: faker.lorem.sentence()
    });
  }
  return claims;
};

const generateClaimBatches = (count, providers, insurers) => {
  const claimBatches = [];
  const statuses = ['Processed', 'Pending', 'Rejected', 'Under Review'];
  
  for (let i = 1; i <= count; i++) {
    const provider = randomChoice(providers);
    const insurer = randomChoice(insurers);
    const submissionDate = faker.date.recent({ days: 15 });
    const processedDate = faker.date.future({ days: 30, refDate: submissionDate });
    const totalAmount = faker.number.float({ min: 1000, max: 50000, fractionDigits: 2 });
    
    claimBatches.push({
      batch_identifier: `BATCH-${faker.string.alphanumeric(8).toUpperCase()}`,
      provider_id: provider.id,
      insurer_id: insurer.id,
      submission_date: submissionDate.toISOString(),
      processed_date: processedDate.toISOString(),
      status: randomChoice(statuses),
      total_amount: totalAmount,
      description: `Batch ${i} containing multiple claims`
    });
  }
  return claimBatches;
};

const generatePayments = (count, claims, providers, insurers) => {
  const payments = [];
  const statuses = ['Completed', 'Pending', 'Failed', 'Processing'];
  const paymentMethods = ['Bank Transfer', 'Check', 'Wire Transfer', 'ACH'];
  
  for (let i = 1; i <= count; i++) {
    const claim = randomChoice(claims);
    const provider = providers.find(p => p.id === claim.provider_id);
    const insurer = insurers.find(ins => ins.id === claim.insurer_id);
    const paymentDate = faker.date.recent({ days: 30 });
    
    payments.push({
      payment_ref_number: `PAY-${faker.string.alphanumeric(10).toUpperCase()}`,
      claim_id: claim.id,
      provider_id: provider.id,
      insurer_id: insurer.id,
      payment_date: paymentDate.toISOString(),
      total_amount: faker.number.float({ min: claim.amount * 0.8, max: claim.amount * 1.2, fractionDigits: 2 }),
      status: randomChoice(statuses),
      method: randomChoice(paymentMethods),
      description: `Payment for claim ${claim.claim_number}`
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
      'payments', 'claims', 'claim_batches', 'eligibility', 
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
    
    // Insert base data first and get IDs
    console.log('\n💾 Inserting base data...');
    
    // Insert patients and get their IDs
    for (const patient of patients) {
      const result = await client.query(`
        INSERT INTO patients (name, identifier, gender, birth_date, phone, email, address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [patient.name, patient.identifier, patient.gender, patient.birth_date, patient.phone, patient.email, patient.address]);
      patient.id = result.rows[0].id;
    }
    console.log(`   ✅ Inserted ${patients.length} patients`);
    
    // Insert providers and get their IDs
    for (const provider of providers) {
      const result = await client.query(`
        INSERT INTO providers (name, type, nphies_id, address, phone, email, contact_person)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [provider.name, provider.type, provider.nphies_id, provider.address, provider.phone, provider.email, provider.contact_person]);
      provider.id = result.rows[0].id;
    }
    console.log(`   ✅ Inserted ${providers.length} providers`);
    
    // Insert insurers and get their IDs
    for (const insurer of insurers) {
      const result = await client.query(`
        INSERT INTO insurers (name, nphies_id, status, contact_person, phone, email, address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `, [insurer.name, insurer.nphies_id, insurer.status, insurer.contact_person, insurer.phone, insurer.email, insurer.address]);
      insurer.id = result.rows[0].id;
    }
    console.log(`   ✅ Inserted ${insurers.length} insurers`);
    
    // Generate dependent data
    const authorizations = generateAuthorizations(CONFIG.authorizations, patients, providers, insurers);
    const eligibilityRequests = generateEligibilityRequests(CONFIG.eligibilityRequests, patients, providers, insurers);
    const claims = generateClaims(CONFIG.claims, patients, providers, insurers, authorizations);
    const claimBatches = generateClaimBatches(CONFIG.claimBatches, providers, insurers);
    const payments = generatePayments(CONFIG.payments, claims, providers, insurers);
    
    // Insert authorizations and get their IDs
    for (const auth of authorizations) {
      const result = await client.query(`
        INSERT INTO authorizations (patient_id, provider_id, insurer_id, request_date, approval_date, status, purpose, amount, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [auth.patient_id, auth.provider_id, auth.insurer_id, auth.request_date, auth.approval_date, auth.status, auth.purpose, auth.amount, auth.notes]);
      auth.id = result.rows[0].id;
    }
    console.log(`   ✅ Inserted ${authorizations.length} authorizations`);
    
    // Insert eligibility requests
    for (const eligibility of eligibilityRequests) {
      await client.query(`
        INSERT INTO eligibility (patient_id, provider_id, insurer_id, request_date, response_date, purpose, status, coverage, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [eligibility.patient_id, eligibility.provider_id, eligibility.insurer_id, eligibility.request_date, eligibility.response_date, eligibility.purpose, eligibility.status, eligibility.coverage, eligibility.notes]);
    }
    console.log(`   ✅ Inserted ${eligibilityRequests.length} eligibility requests`);
    
    // Insert claims and get their IDs
    for (const claim of claims) {
      const result = await client.query(`
        INSERT INTO claims (claim_number, patient_id, provider_id, insurer_id, authorization_id, submission_date, processed_date, status, amount, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `, [claim.claim_number, claim.patient_id, claim.provider_id, claim.insurer_id, claim.authorization_id, claim.submission_date, claim.processed_date, claim.status, claim.amount, claim.description]);
      claim.id = result.rows[0].id;
    }
    console.log(`   ✅ Inserted ${claims.length} claims`);
    
    // Insert claim batches
    for (const batch of claimBatches) {
      await client.query(`
        INSERT INTO claim_batches (batch_identifier, provider_id, insurer_id, submission_date, processed_date, status, total_amount, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [batch.batch_identifier, batch.provider_id, batch.insurer_id, batch.submission_date, batch.processed_date, batch.status, batch.total_amount, batch.description]);
    }
    console.log(`   ✅ Inserted ${claimBatches.length} claim batches`);
    
    // Insert payments
    for (const payment of payments) {
      await client.query(`
        INSERT INTO payments (payment_ref_number, claim_id, provider_id, insurer_id, payment_date, total_amount, status, method, description)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [payment.payment_ref_number, payment.claim_id, payment.provider_id, payment.insurer_id, payment.payment_date, payment.total_amount, payment.status, payment.method, payment.description]);
    }
    console.log(`   ✅ Inserted ${payments.length} payments`);
    
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
seedDatabase()
  .then(() => {
    console.log('✅ Seeding process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Seeding process failed:', error);
    process.exit(1);
  });
