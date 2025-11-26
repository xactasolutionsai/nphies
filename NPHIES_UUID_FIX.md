# NPHIES UUID Database Fix

## Issue
Your database uses UUID for all ID columns (patient_id, provider_id, insurer_id, etc.), but the original migration script assumed INTEGER types.

## ✅ Fix Applied

### 1. New Migration Script Created
**File:** `backend/migrations/add_nphies_integration_uuid.sql`

This is the corrected version that:
- Uses UUID for all ID columns
- Uses `gen_random_uuid()` for UUID generation
- References UUID columns correctly
- Works with your existing UUID-based schema

### 2. Backend Code Updated
Updated the following files to work with UUIDs:
- `backend/services/nphiesMapper.js` - Converts UUIDs to strings properly
- `backend/controllers/eligibilityController.js` - Handles UUIDs (no parseInt needed)

## 🚀 How to Run the Fixed Migration

### Step 1: Run the UUID Migration Script

In pgAdmin:
1. Open Query Tool
2. Load file: `backend/migrations/add_nphies_integration_uuid.sql`
3. Execute (F5)
4. You should see: "NPHIES Integration Migration (UUID Version) Completed Successfully!"

### Expected Output:
```
NOTICE:  column "nphies_id" of relation "providers" already exists, skipping
NOTICE:  column "nphies_id" of relation "insurers" already exists, skipping
... (other notices about existing columns are fine)
QUERY RESULTS: "NPHIES Integration Migration (UUID Version) Completed Successfully!"
```

### Step 2: Verify Tables Created

```sql
-- Check patient_coverage table
SELECT * FROM patient_coverage LIMIT 5;

-- Check eligibility table columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'eligibility' 
ORDER BY ordinal_position;
```

You should see:
- `patient_coverage` table exists with UUID coverage_id
- `eligibility` table has new columns: coverage_id, nphies_request_id, raw_request, raw_response, etc.

### Step 3: Restart Backend

```bash
cd backend
npm start
```

### Step 4: Test It!

1. Navigate to **NPHIES Eligibility** page
2. Select a patient, provider, insurer
3. The coverage dropdown should populate automatically
4. Submit an eligibility check
5. Results should display successfully!

## 🔍 What Changed

### Database Schema Changes:

1. **patient_coverage table:**
   ```sql
   coverage_id UUID PRIMARY KEY (not SERIAL)
   patient_id UUID (not INTEGER)
   insurer_id UUID (not INTEGER)
   ```

2. **eligibility table additions:**
   - coverage_id UUID (references patient_coverage)
   - nphies_request_id VARCHAR(100)
   - nphies_response_id VARCHAR(100)
   - raw_request JSONB
   - raw_response JSONB
   - outcome VARCHAR(20)
   - inforce BOOLEAN
   - error_codes JSONB
   - benefits JSONB
   - serviced_date DATE
   - response_date TIMESTAMP

### Backend Code Changes:

**nphiesMapper.js:**
- Changed: `patient-${patient.patient_id}`
- To: `patient-${patient.patient_id?.toString()}`
- Applied to all ID fields (patient, provider, insurer, coverage)

**eligibilityController.js:**
- Removed parseInt() calls (UUIDs are strings)
- IDs passed directly to database queries

## 📋 Sample Data Inserted

The migration automatically:
1. Sets first provider's nphies_id to 'provider-license'
2. Sets first insurer's nphies_id to 'payer-license'
3. Creates 5 sample coverage records linking patients to insurers

## 🎯 Testing Checklist

- [ ] Run the UUID migration script
- [ ] Verify patient_coverage table exists
- [ ] Verify eligibility table has new columns
- [ ] Check sample coverage data exists
- [ ] Restart backend server
- [ ] Navigate to NPHIES Eligibility page
- [ ] Select patient and verify coverage dropdown populates
- [ ] Submit eligibility check
- [ ] Verify results display correctly
- [ ] Check database for saved eligibility record

## 🐛 Troubleshooting

### "column already exists" notices
**Normal!** The script uses `IF NOT EXISTS` clauses, so these notices are expected.

### "relation patient_coverage does not exist"
Run the UUID migration script. The original script failed before creating this table.

### "No coverages found for patient"
```sql
-- Manually insert a coverage
INSERT INTO patient_coverage (patient_id, insurer_id, policy_number, member_id)
SELECT 
    patient_id, 
    (SELECT insurer_id FROM insurers LIMIT 1),
    'POL-TEST-001',
    'MEM-TEST-001'
FROM patients LIMIT 1;
```

### Backend errors about UUIDs
Make sure you restarted the backend after pulling the updated code.

## ✅ Success Indicators

You'll know it's working when:
1. ✅ Migration script completes without errors
2. ✅ patient_coverage table has records
3. ✅ NPHIES Eligibility page loads without errors
4. ✅ Coverage dropdown shows policies when patient is selected
5. ✅ Eligibility check returns results
6. ✅ Database shows new eligibility records with NPHIES data

---

## Files Modified/Created

**New Files:**
- `backend/migrations/add_nphies_integration_uuid.sql` (CORRECTED VERSION)

**Modified Files:**
- `backend/services/nphiesMapper.js` (UUID handling)
- `backend/controllers/eligibilityController.js` (UUID handling)

**Old File (Ignore):**
- `backend/migrations/add_nphies_integration.sql` (INTEGER version - don't use)

---

**Ready to Test!** 🚀

Run the UUID migration script and everything should work perfectly with your UUID-based database.

