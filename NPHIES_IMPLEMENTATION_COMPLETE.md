# NPHIES Eligibility Integration - Implementation Complete

## ✅ Implementation Summary

The NPHIES Eligibility Integration has been successfully implemented. This document provides guidance on setup, testing, and usage.

---

## 🎯 What Has Been Implemented

### Backend Components

1. **Database Migration** (`backend/migrations/add_nphies_integration.sql`)
   - Added NPHIES-specific columns to `providers` and `insurers` tables
   - Created `patient_coverage` table for insurance policies
   - Updated `eligibility` table with NPHIES fields
   - Added performance indexes
   - Included sample test data

2. **NPHIES Mapper Service** (`backend/services/nphiesMapper.js`)
   - Maps database entities to FHIR R4 resources
   - Builds complete FHIR bundles following NPHIES specifications
   - Parses FHIR responses back to simple objects
   - Functions:
     - `buildPatientResource()` - FHIR Patient
     - `buildProviderOrganization()` - Provider Organization
     - `buildPayerOrganization()` - Insurer Organization
     - `buildCoverageResource()` - Coverage/Policy
     - `buildCoverageEligibilityRequest()` - Eligibility Request
     - `buildMessageHeader()` - Message Header (must be first)
     - `buildEligibilityRequestBundle()` - Complete bundle
     - `parseEligibilityResponse()` - Parse response

3. **NPHIES Service** (`backend/services/nphiesService.js`)
   - Handles HTTP communication with NPHIES OBA API
   - Implements retry logic with exponential backoff
   - Validates FHIR response structure
   - Error handling and formatting
   - Endpoint: `http://176.105.150.83/$process-message`

4. **Eligibility Controller Updates** (`backend/controllers/eligibilityController.js`)
   - New method: `checkNphiesEligibility()` - Main eligibility check
   - New method: `getNphiesDetails()` - Get full FHIR data
   - New method: `getPatientCoverages()` - Get patient's coverages

5. **API Routes** (`backend/routes/eligibility.js`)
   - `POST /api/eligibility/check-nphies` - Check eligibility
   - `GET /api/eligibility/:id/nphies-details` - Get FHIR details
   - `GET /api/eligibility/patient/:patientId/coverages` - Get coverages

### Frontend Components

1. **NPHIES Eligibility Page** (`frontend/src/pages/NphiesEligibility.jsx`)
   - Complete eligibility checking form
   - Static example dropdown with NPHIES sample data
   - Dynamic dropdowns for patients, providers, insurers, coverages
   - Purpose selection (discovery, benefits, validation)
   - Service date picker
   - Results display with:
     - Coverage status (in-force/eligible)
     - Benefits breakdown
     - Error messages
     - Raw FHIR request/response viewer

2. **Static Example Data** (`frontend/src/data/nphiesExampleBundle.json`)
   - NPHIES official example bundle (Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959)
   - Can be used for testing without database data

3. **API Service Updates** (`frontend/src/services/api.js`)
   - `checkNphiesEligibility(data)` - Submit eligibility check
   - `getNphiesEligibilityDetails(id)` - Get details
   - `getPatientCoverages(patientId)` - Get coverages

4. **Navigation** (`frontend/src/App.jsx` & `frontend/src/components/Layout.jsx`)
   - New route: `/nphies-eligibility`
   - New menu item: "NPHIES Eligibility" (with Shield icon)

---

## 🚀 Setup Instructions

### Step 1: Database Migration

Run the migration SQL in pgAdmin:

1. Open pgAdmin and connect to your `nafes_healthcare` database
2. Open Query Tool (Tools > Query Tool)
3. Load the file: `backend/migrations/add_nphies_integration.sql`
4. Execute the query (F5 or click Execute)
5. Verify success message: "NPHIES Integration Migration Completed Successfully!"

**What This Does:**
- Adds NPHIES ID columns to providers/insurers
- Creates patient_coverage table
- Updates eligibility table with NPHIES fields
- Adds indexes for performance
- Inserts sample test data

### Step 2: Environment Configuration

The environment variables are already in `backend/env.example`. Ensure your `.env` file includes:

```env
# NPHIES Configuration
NPHIES_BASE_URL=http://176.105.150.83
NPHIES_TIMEOUT=60000
NPHIES_RETRY_ATTEMPTS=3
```

**Note:** The OBA test environment at `http://176.105.150.83` does not require OAuth authentication.

### Step 3: Install Dependencies

Axios has already been installed for the backend. If needed:

```bash
cd backend
npm install axios --legacy-peer-deps
```

### Step 4: Restart Backend Server

```bash
cd backend
npm start
```

Or with nodemon:

```bash
npm run dev
```

### Step 5: Start Frontend

```bash
cd frontend
npm run dev
```

---

## 🧪 Testing Guide

### Test 1: Using Static Example Data

This is the easiest way to test without setting up database records.

1. Navigate to **NPHIES Eligibility** in the sidebar
2. Click **"Load NPHIES Example Data"** button
3. An alert will show the example data details
4. The form fields will be ready (though the example is static)
5. Click **"Check Eligibility"** to submit

**Expected Result:**
- Request sent to OBA API
- Response displayed with coverage status
- Benefits shown (if available)
- Raw FHIR data viewable

### Test 2: Using Database Records

**Prerequisites:**
- At least one patient in the database
- At least one provider with `nphies_id` set (e.g., 'provider-license')
- At least one insurer with `nphies_id` set (e.g., 'payer-license')
- At least one coverage record in `patient_coverage` table

**Steps:**
1. Navigate to **NPHIES Eligibility**
2. Select a patient from the dropdown
3. Select a provider (preferably one with NPHIES ID)
4. Select an insurer (preferably one with NPHIES ID)
5. Select a coverage/policy for the patient
6. Select purpose: Check "benefits" and "validation"
7. Set service date (default is today)
8. Click **"Check Eligibility"**

**Expected Result:**
- Backend builds FHIR bundle from database data
- Sends to NPHIES OBA API
- Receives response
- Displays results on screen
- Saves to database

### Test 3: Verify Database Storage

After submitting an eligibility check:

```sql
SELECT 
    e.eligibility_id,
    e.outcome,
    e.inforce,
    e.nphies_request_id,
    e.nphies_response_id,
    p.name as patient_name,
    pr.provider_name,
    i.insurer_name
FROM eligibility e
LEFT JOIN patients p ON e.patient_id = p.patient_id
LEFT JOIN providers pr ON e.provider_id = pr.provider_id
LEFT JOIN insurers i ON e.insurer_id = i.insurer_id
ORDER BY e.eligibility_id DESC
LIMIT 10;
```

You should see:
- `outcome` = 'complete' or 'error'
- `inforce` = true/false (if successful)
- `nphies_request_id` and `nphies_response_id` populated
- `raw_request` and `raw_response` contain JSONB data

### Test 4: API Testing with Postman/RestFox

**Endpoint:** `POST http://localhost:8001/api/eligibility/check-nphies`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "patientId": 1,
  "providerId": 1,
  "insurerId": 1,
  "coverageId": 1,
  "purpose": ["benefits", "validation"],
  "servicedDate": "2025-11-24"
}
```

**Expected Response:**
```json
{
  "success": true,
  "eligibilityId": 123,
  "outcome": "complete",
  "inforce": true,
  "patient": {
    "name": "Patient Name",
    "identifier": "2234567890"
  },
  "provider": {
    "name": "Provider Name"
  },
  "insurer": {
    "name": "Insurer Name"
  },
  "coverage": {
    "policyNumber": "POL-123456",
    "type": "EHCPOL"
  },
  "benefits": [...],
  "nphiesResponseId": "response-id",
  "errors": [],
  "raw": {
    "request": {...},
    "response": {...}
  }
}
```

---

## 📊 Features Overview

### Form Features

- **Patient Selection:** Dropdown of all patients in database
- **Provider Selection:** Dropdown of all providers (shows NPHIES ID if available)
- **Insurer Selection:** Dropdown of all insurers (shows NPHIES ID if available)
- **Coverage Selection:** Auto-loads when patient is selected, filtered by patient
- **Purpose Checkboxes:** 
  - Discovery: Find all active coverages
  - Benefits: Get benefit details
  - Validation: Verify coverage is active
- **Service Date:** Date picker (defaults to today)
- **Example Data:** Load static NPHIES example for testing
- **Clear Form:** Reset all fields

### Results Display

- **Coverage Status:** Shows if coverage is in-force (eligible)
- **Patient Info:** Name and identifier
- **Coverage Details:** Policy number and type
- **Benefits Breakdown:** Category, allowed, used, remaining amounts
- **Error Messages:** Detailed error codes and descriptions
- **Raw FHIR Data:** Collapsible view of request/response bundles

### Data Storage

All eligibility checks are saved to the database with:
- Request/response timestamps
- Outcome (complete, error, queued)
- In-force status
- Benefits (as JSONB)
- Error codes (as JSONB)
- Full FHIR request/response (as JSONB)

---

## 🔍 Troubleshooting

### Issue: "Patient does not have coverage"

**Solution:**
1. Check if patient has records in `patient_coverage` table
2. Run migration again to insert sample coverage
3. Or manually insert coverage:
```sql
INSERT INTO patient_coverage (patient_id, insurer_id, policy_number, member_id, relationship, start_date, end_date)
VALUES (1, 1, 'POL-TEST-001', 'MEM-TEST-001', 'self', CURRENT_DATE - INTERVAL '1 year', CURRENT_DATE + INTERVAL '1 year');
```

### Issue: "Provider does not have NPHIES ID"

**Solution:**
Update provider with NPHIES ID:
```sql
UPDATE providers 
SET nphies_id = 'provider-license' 
WHERE provider_id = 1;
```

### Issue: "Insurer does not have NPHIES ID"

**Solution:**
Update insurer with NPHIES ID:
```sql
UPDATE insurers 
SET nphies_id = 'payer-license' 
WHERE insurer_id = 1;
```

### Issue: "NPHIES request failed" or "No response"

**Possible Causes:**
1. OBA test server is down
2. Network/firewall blocking the request
3. Invalid FHIR bundle structure

**Solutions:**
1. Check backend console logs for detailed error messages
2. Verify OBA endpoint is accessible: http://176.105.150.83
3. Check raw request bundle in browser console
4. Test with static example first

### Issue: Frontend shows "Failed to load initial data"

**Solution:**
1. Ensure backend is running on port 8001
2. Check backend console for errors
3. Verify database connection
4. Check that tables (patients, providers, insurers) exist and have data

---

## 📝 Key Files Reference

### Backend
- `backend/migrations/add_nphies_integration.sql` - Database migration
- `backend/services/nphiesMapper.js` - FHIR mapping logic
- `backend/services/nphiesService.js` - API communication
- `backend/controllers/eligibilityController.js` - Business logic
- `backend/routes/eligibility.js` - API routes
- `backend/env.example` - Environment configuration

### Frontend
- `frontend/src/pages/NphiesEligibility.jsx` - Main page
- `frontend/src/data/nphiesExampleBundle.json` - Static example
- `frontend/src/services/api.js` - API client methods
- `frontend/src/App.jsx` - Routing
- `frontend/src/components/Layout.jsx` - Navigation menu

---

## 🎓 Understanding NPHIES FHIR Structure

### Message Bundle Structure

Every NPHIES request is a FHIR Bundle with:

1. **MessageHeader** (MUST be first)
   - Event type (e.g., 'eligibility-request')
   - Sender (provider organization)
   - Destination (insurer organization)
   - Focus (reference to main resource)

2. **CoverageEligibilityRequest**
   - Purpose (discovery, benefits, validation)
   - Patient reference
   - Coverage reference
   - Service date

3. **Patient Resource**
   - Identifier (National ID, Iqama, Passport)
   - Name, gender, birth date
   - Contact info, address

4. **Coverage Resource**
   - Policy number, member ID
   - Coverage type (EHCPOL, etc.)
   - Relationship (self, spouse, child)
   - Period (start/end dates)

5. **Organization Resources**
   - Provider: Healthcare facility
   - Insurer: Insurance company
   - Both must have NPHIES license IDs

### Response Bundle Structure

NPHIES returns a Bundle with:

1. **MessageHeader** (response)

2. **CoverageEligibilityResponse**
   - Outcome: complete, error, queued, partial
   - Disposition: Human-readable status
   - Insurance array with:
     - inforce: boolean (coverage active?)
     - item array: Benefits by category

3. **Patient, Coverage, Organizations** (echoed back)

4. **OperationOutcome** (if errors)
   - Issue array with error codes and details

---

## 🔗 Resources

- **NPHIES Portal:** https://portal.nphies.sa
- **NPHIES Implementation Guide:** https://portal.nphies.sa/ig/
- **Eligibility Use Case:** https://portal.nphies.sa/ig/usecase-eligibility.html
- **Example Request:** https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.html
- **FHIR R4 Specification:** https://hl7.org/fhir/R4/

---

## ✅ Checklist for Production

Before deploying to production:

- [ ] Run database migration on production database
- [ ] Update all providers with real NPHIES license IDs
- [ ] Update all insurers with real NPHIES payer license IDs
- [ ] Populate patient_coverage table with real policy data
- [ ] Ensure patients have valid identifiers (National ID/Iqama)
- [ ] Update `NPHIES_BASE_URL` to production: `https://hsb.nphies.sa`
- [ ] Configure OAuth credentials (NPHIES_CLIENT_ID, NPHIES_CLIENT_SECRET)
- [ ] Implement OAuth token management in nphiesService.js
- [ ] Complete NPHIES certification process
- [ ] Test with real patient data in sandbox environment first
- [ ] Set up monitoring and logging for NPHIES requests
- [ ] Configure error alerting
- [ ] Document any custom business rules or validations
- [ ] Train staff on using the NPHIES Eligibility page
- [ ] Create backup and rollback procedures

---

## 🎉 Conclusion

The NPHIES Eligibility Integration is now complete and ready for testing. The implementation follows NPHIES FHIR R4 specifications and provides a user-friendly interface for checking patient eligibility.

**Next Steps:**
1. Run the database migration
2. Test with static example data
3. Add sample provider/insurer NPHIES IDs
4. Create test coverage records
5. Submit real eligibility checks
6. Review results and raw FHIR data

For questions or issues, refer to the troubleshooting section or check the backend console logs for detailed error messages.

**Happy Testing! 🚀**

