# 🌱 Database Seeding Script - Nafes Healthcare System

A comprehensive Node.js script that generates realistic fake data for the Nafes Healthcare Management System with NPHIES compliance.

## ⚠️ Destructive: explicit opt-in required

The seed scripts (`seed.js`, `seed-fixed.js`, `seed-corrected.js`) TRUNCATE patients, providers,
insurers and every table referencing them. They refuse to run unless
`ALLOW_DESTRUCTIVE_SEED=true` is set (in `.env` or the shell), and never run with
`NODE_ENV=production` (see `scripts/seedGuard.js`). Only use them on a disposable database.

```cmd
REM Windows (cmd)
set ALLOW_DESTRUCTIVE_SEED=true
```
```bash
# Linux / macOS
ALLOW_DESTRUCTIVE_SEED=true npm run seed
```

## 🚀 Quick Start

### **Windows Users**
```cmd
# Run the automated seeding script
run-seed.bat
```

### **Manual Execution**
```cmd
# Install dependencies
npm install

# Run the seeding script
npm run seed
# OR
node seed.js
```

## 📊 Generated Data

The script generates the following realistic test data:

| Table | Count | Description |
|-------|-------|-------------|
| **Patients** | 50+ | Arabic names, NPHIES IDs, newborn flags |
| **Providers** | 10+ | Hospitals, clinics, dental centers |
| **Insurers** | 5+ | Major Saudi insurance companies |
| **Authorizations** | 100+ | Pre-authorization requests with relationships |
| **Eligibility Requests** | 80+ | Coverage verification requests |
| **Claims** | 200+ | Healthcare claims with proper linking |
| **Claim Batches** | 10+ | Batches containing 10-30 claims each |
| **Payments** | 100+ | Payment transactions linked to claims |

## 🏥 NPHIES-Specific Features

### **Patient Data**
- **NPHIES IDs**: Format `PAT-00001`, `PAT-00002`, etc.
- **Arabic Names**: Realistic Saudi names (أحمد محمد العلي)
- **Newborn Flag**: Automatically set for patients < 30 days old
- **Transfer Flag**: 10% of patients have transfer status
- **Saudi Phone Numbers**: +966 format with valid prefixes

### **Provider Data**
- **NPHIES IDs**: Format `PROV-001`, `PROV-002`, etc.
- **Arabic Names**: مستشفى الملك فهد, عيادة د. أحمد محمد
- **Types**: Hospital, Clinic, Dental Center, Pharmacy, Laboratory
- **Saudi Addresses**: Realistic addresses with Saudi cities

### **Insurer Data**
- **NPHIES IDs**: Format `INS-001`, `INS-002`, etc.
- **Real Companies**: التأمين الصحي السعودي, بوبا العربية, etc.
- **Status**: Active, Inactive, Suspended

### **Authorization Data**
- **Status Codes**: approved, denied, pending, under_review
- **Auth Numbers**: AUTH-XXXXXXXX format
- **Purposes**: Surgery, Consultation, Emergency, Dental, etc.
- **Proper Linking**: Connected to patients, providers, insurers

### **Eligibility Data**
- **Coverage Codes**: C10, C20, C30, C40, C50 (NPHIES format)
- **Service Codes**: S001, S002, S003, S004, S005
- **Policy Numbers**: POL-2024-XXXXXXXX format
- **Purposes**: benefits, coverage, or both

### **Claims Data**
- **Claim Numbers**: CLM-XXXXXXXXXX format
- **Service Types**: Consultation, Surgery, Laboratory, etc.
- **Status**: submitted, adjudicated, denied, paid, pending
- **Authorization Linking**: 70% of claims linked to authorizations

### **Payment Data**
- **Payment References**: PAY-XXXXXXXXXX format
- **Payment Methods**: Bank Transfer, Check, Wire Transfer, ACH
- **Status**: completed, pending, failed, processing
- **Amount Calculation**: Based on linked claim amounts

## 🔧 Configuration

### **Adjust Data Counts**
Edit the `CONFIG` object in `seed.js`:

```javascript
const CONFIG = {
  patients: 50,           // Number of patients to generate
  providers: 10,          // Number of providers
  insurers: 5,            // Number of insurers
  authorizations: 100,    // Number of authorizations
  eligibilityRequests: 80, // Number of eligibility requests
  claims: 200,            // Number of claims
  claimBatches: 10,       // Number of claim batches
  payments: 100,          // Number of payments
};
```

### **Database Schema**
The script works with the updated schema that includes:
- **UUIDs** for all primary keys
- **NPHIES-specific fields** (newborn_flag, transfer_flag, etc.)
- **Proper relationships** between all tables
- **Indexes** for optimal performance

## 🗄️ Database Setup

### **1. Create Database with UUID Schema**
```sql
-- Run the UUID schema
psql -U postgres -d nafes_healthcare -f schema-with-uuid.sql
```

### **2. Environment Configuration**
Ensure your `.env` file has correct database credentials:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nafes_healthcare
DB_USER=postgres
DB_PASSWORD=your_password
```

## 📋 Data Relationships

The script ensures proper relationships:

```
Patients (1) ←→ (Many) Authorizations
Patients (1) ←→ (Many) Eligibility Requests
Patients (1) ←→ (Many) Claims

Providers (1) ←→ (Many) Authorizations
Providers (1) ←→ (Many) Eligibility Requests
Providers (1) ←→ (Many) Claims
Providers (1) ←→ (Many) Payments

Insurers (1) ←→ (Many) Authorizations
Insurers (1) ←→ (Many) Eligibility Requests
Insurers (1) ←→ (Many) Claims
Insurers (1) ←→ (Many) Payments

Authorizations (1) ←→ (Many) Claims
Claims (Many) ←→ (1) Claim Batches
Claims (1) ←→ (1) Payments
```

## 🎯 Sample Generated Data

### **Patient Example**
```json
{
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "nphies_id": "PAT-00001",
  "first_name": "أحمد",
  "last_name": "العلي",
  "gender": "Male",
  "date_of_birth": "1985-03-15",
  "newborn_flag": false,
  "transfer_flag": false,
  "phone": "+966501234567",
  "email": "ahmed.ali@example.com",
  "address": "شارع الملك فهد, الرياض, المملكة العربية السعودية"
}
```

### **Provider Example**
```json
{
  "provider_id": "123e4567-e89b-12d3-a456-426614174001",
  "nphies_id": "PROV-001",
  "name": "مستشفى الملك فهد التخصصي",
  "type": "hospital",
  "address": "شارع الملك فهد, الرياض, المملكة العربية السعودية",
  "phone": "+966112345678",
  "contact_person": "د. أحمد محمد"
}
```

### **Claim Example**
```json
{
  "claim_id": "123e4567-e89b-12d3-a456-426614174002",
  "claim_number": "CLM-A1B2C3D4E5",
  "patient_id": "123e4567-e89b-12d3-a456-426614174000",
  "provider_id": "123e4567-e89b-12d3-a456-426614174001",
  "insurer_id": "123e4567-e89b-12d3-a456-426614174003",
  "service_date": "2024-01-15T10:30:00Z",
  "claim_status": "adjudicated",
  "service_type": "Surgery",
  "amount": 15000.00
}
```

## 🔄 Re-running the Script

The script automatically:
- **Truncates all tables** before inserting new data
- **Maintains referential integrity** with proper foreign keys
- **Generates fresh data** each time it runs
- **Provides detailed logging** of the process

## 🛠️ Troubleshooting

### **Common Issues**

1. **Database Connection Failed**
   - Check PostgreSQL is running
   - Verify credentials in `.env`
   - Ensure database exists

2. **UUID Extension Missing**
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   ```

3. **Permission Denied**
   - Ensure user has CREATE and INSERT permissions
   - Run as database owner or superuser

4. **Memory Issues with Large Datasets**
   - Reduce counts in CONFIG
   - Run in smaller batches

### **Logs and Debugging**

The script provides detailed logging:
- ✅ Table truncation status
- ✅ Data generation progress
- ✅ Insert operation results
- ✅ Final summary with counts

## 📈 Performance

- **Batch Insertion**: Uses efficient batch inserts
- **Transaction Safety**: All operations in transactions
- **Indexed Fields**: Proper indexes for fast queries
- **Memory Efficient**: Processes data in chunks

## 🎉 Next Steps

After running the seeding script:

1. **Start Backend**: `npm run dev`
2. **Start Frontend**: `cd ../frontend && npm run dev`
3. **View Dashboard**: http://localhost:5173
4. **Test API**: http://localhost:8000/health

The generated data will provide a realistic testing environment for your NPHIES healthcare management system!

---

**Built with ❤️ for the Nafes Healthcare Management System**
