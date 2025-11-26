# nphies Eligibility Integration Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Database Requirements](#database-requirements)
5. [Environment Configuration](#environment-configuration)
6. [Implementation Steps](#implementation-steps)
7. [Field Mappings](#field-mappings)
8. [Code Structure](#code-structure)
9. [Testing](#testing)
10. [Error Handling](#error-handling)
11. [Production Checklist](#production-checklist)

---

## Overview

### What is nphies?
nphies (National Platform for Health Insurance Services) is Saudi Arabia's central clearinghouse for healthcare insurance transactions. It acts as a middleware between healthcare providers and insurance companies.

### Integration Flow
```
Your System → nphies Clearinghouse → Insurance Companies
           ←                        ←
```

### What We're Building
A service layer that:
- Translates your database format to FHIR format
- Sends eligibility requests to nphies
- Parses responses back to your format
- Handles errors and edge cases

---

## Architecture

### System Layers
```
┌─────────────────────────────────────────────┐
│  Frontend (React/UI)                         │
│  - Eligibility form                          │
│  - Results display                           │
└──────────────────┬──────────────────────────┘
                   ↓ API calls
┌─────────────────────────────────────────────┐
│  Controllers Layer                           │
│  - eligibilityController.js                  │
│  - Handle HTTP requests/responses            │
└──────────────────┬──────────────────────────┘
                   ↓ Service calls
┌─────────────────────────────────────────────┐
│  Service/Middleware Layer (NEW)              │
│  - nphiesService.js                          │
│  - nphiesMapper.js                           │
│  - Build FHIR bundles                        │
│  - Parse responses                           │
└──────────────────┬──────────────────────────┘
                   ↓ Database queries
┌─────────────────────────────────────────────┐
│  Database (PostgreSQL)                       │
│  - patients, providers, insurers             │
└──────────────────┬──────────────────────────┘
                   ↓ HTTP POST
┌─────────────────────────────────────────────┐
│  nphies API (External)                       │
│  - https://hsb.nphies.sa/$process-message    │
└─────────────────────────────────────────────┘
```

---

## Prerequisites

### 1. nphies Registration
- [ ] Register your facility at https://portal.nphies.sa
- [ ] Obtain Provider License ID (nphies ID)
- [ ] Obtain OAuth Client ID and Client Secret
- [ ] Get sandbox credentials for testing
- [ ] Complete certification process

### 2. Required IDs
You need to collect and store:
- **Provider nphies ID**: Your facility's license (e.g., `7001234`)
- **Insurer nphies IDs**: For all insurers you work with
- **Location License ID**: For each facility location

### 3. Technical Requirements
- Node.js backend with Express
- PostgreSQL database
- axios or similar HTTP client
- Understanding of FHIR R4 standard

---

## Database Requirements

### Tables to Create/Update

#### 1. Add `nphies_id` to `providers` table
```sql
ALTER TABLE providers ADD COLUMN IF NOT EXISTS nphies_id VARCHAR(50);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS provider_type VARCHAR(20);
ALTER TABLE providers ADD COLUMN IF NOT EXISTS location_license VARCHAR(50);

-- Add index
CREATE INDEX idx_providers_nphies_id ON providers(nphies_id);
```

#### 2. Add `nphies_id` to `insurers` table
```sql
ALTER TABLE insurers ADD COLUMN IF NOT EXISTS nphies_id VARCHAR(50);

-- Add index
CREATE INDEX idx_insurers_nphies_id ON insurers(nphies_id);
```

#### 3. Update `patients` table
```sql
-- Ensure these columns exist
ALTER TABLE patients ADD COLUMN IF NOT EXISTS identifier VARCHAR(50); -- National ID/Iqama
ALTER TABLE patients ADD COLUMN IF NOT EXISTS identifier_type VARCHAR(20); -- 'iqama', 'national_id', 'passport'
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality VARCHAR(3); -- ISO country code
ALTER TABLE patients ADD COLUMN IF NOT EXISTS occupation VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20);

-- Add index
CREATE INDEX idx_patients_identifier ON patients(identifier);
```

#### 4. Create `patient_coverage` table
```sql
CREATE TABLE IF NOT EXISTS patient_coverage (
    coverage_id SERIAL PRIMARY KEY,
    patient_id INTEGER REFERENCES patients(patient_id) ON DELETE CASCADE,
    insurer_id INTEGER REFERENCES insurers(insurer_id),
    policy_number VARCHAR(100) NOT NULL,
    member_id VARCHAR(100),
    coverage_type VARCHAR(50), -- 'EHCPOL', 'PUBLICPOL', etc.
    relationship VARCHAR(20), -- 'self', 'spouse', 'child', 'parent'
    dependent_number VARCHAR(10),
    plan_name VARCHAR(255),
    network_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_patient_coverage_patient ON patient_coverage(patient_id);
CREATE INDEX idx_patient_coverage_policy ON patient_coverage(policy_number);
```

#### 5. Update `eligibility` table
```sql
-- Add columns for nphies integration
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS nphies_request_id VARCHAR(100);
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS nphies_response_id VARCHAR(100);
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS raw_request JSONB;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS raw_response JSONB;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS outcome VARCHAR(20); -- 'complete', 'error', 'queued', 'partial'
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS inforce BOOLEAN;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS error_codes JSONB;
ALTER TABLE eligibility ADD COLUMN IF NOT EXISTS benefits JSONB;

-- Add indexes
CREATE INDEX idx_eligibility_nphies_request ON eligibility(nphies_request_id);
CREATE INDEX idx_eligibility_outcome ON eligibility(outcome);
```

---

## Environment Configuration

### Add to `.env` file
```env
# nphies Configuration
NPHIES_ENVIRONMENT=sandbox # or 'production'
NPHIES_BASE_URL=http://176.105.150.83 # OBA test environment
NPHIES_PRODUCTION_URL=https://hsb.nphies.sa
NPHIES_OAUTH_URL=https://hsb.nphies.sa/oauth/token

# Your Credentials (from nphies portal)
NPHIES_PROVIDER_ID=PR-FHIR # Replace with your real provider ID
NPHIES_CLIENT_ID=your_client_id
NPHIES_CLIENT_SECRET=your_client_secret

# Optional
NPHIES_TIMEOUT=60000 # 60 seconds
NPHIES_RETRY_ATTEMPTS=3
```

### Update `backend/env.example`
Add the same variables to your example file for documentation.

---

## Implementation Steps

### Step 1: Create nphiesMapper.js
**File**: `backend/services/nphiesMapper.js`

This handles all data transformation between your DB format and FHIR format.

**Responsibilities:**
- Map patient data to FHIR Patient resource
- Map provider data to FHIR Organization resource
- Map insurer data to FHIR Organization resource
- Map coverage data to FHIR Coverage resource
- Build complete FHIR Bundle
- Parse FHIR responses back to simple objects

### Step 2: Create nphiesService.js
**File**: `backend/services/nphiesService.js`

This handles communication with nphies API.

**Responsibilities:**
- OAuth token management (get, cache, refresh)
- HTTP communication with nphies
- Error handling and retries
- Response validation

### Step 3: Update eligibilityController.js
**File**: `backend/controllers/eligibilityController.js`

Add new endpoint for nphies integration.

**New Methods:**
- `checkWithNphies(req, res)` - Main eligibility check endpoint
- `getEligibilityDetails(req, res)` - Get full details with FHIR data

### Step 4: Create/Update Routes
**File**: `backend/routes/eligibility.js`

Add new routes for nphies functionality.

### Step 5: Frontend Integration
Update your eligibility form to use the new endpoint.

---

## Field Mappings

### Patient: Database → FHIR

| Your DB Field | FHIR Path | Format | Notes |
|--------------|-----------|---------|-------|
| `patient_id` | Internal only | - | Not sent to nphies |
| `identifier` | `Patient.identifier[0].value` | String | National ID/Iqama |
| `identifier_type` | `Patient.identifier[0].type.coding[0].code` | Code | 'PPN', 'NI', 'MR' |
| `name` | `Patient.name[0].text` | String | Full name |
| `name` (split) | `Patient.name[0].family` | String | Last name |
| `name` (split) | `Patient.name[0].given[]` | Array | First/middle names |
| `gender` | `Patient.gender` | Code | 'male', 'female', 'unknown' |
| `date_of_birth` | `Patient.birthDate` | Date | YYYY-MM-DD |
| `phone` | `Patient.telecom[0].value` | String | Include country code |
| `address` | `Patient.address[0].line[]` | Array | Street address |
| `city` | `Patient.address[0].city` | String | City name |
| `country` | `Patient.address[0].country` | String | 'Saudi Arabia' |
| `marital_status` | `Patient.maritalStatus.coding[0].code` | Code | 'M', 'S', 'D', etc. |
| `occupation` | `Patient.extension[occupation]` | Code | From nphies code system |

### Provider: Database → FHIR

| Your DB Field | FHIR Path | Format | Notes |
|--------------|-----------|---------|-------|
| `nphies_id` | `Organization.identifier[0].value` | String | CRITICAL - provider license |
| `provider_name` | `Organization.name` | String | Facility name |
| `provider_type` | `Organization.extension[provider-type]` | Code | '1'=Hospital, '2'=Clinic, etc. |
| `address` | `Organization.address[0]` | Object | Full address |
| `phone` | `Organization.telecom[0]` | Object | Contact info |

### Insurer: Database → FHIR

| Your DB Field | FHIR Path | Format | Notes |
|--------------|-----------|---------|-------|
| `nphies_id` | `Organization.identifier[0].value` | String | CRITICAL - payer license |
| `insurer_name` | `Organization.name` | String | Insurance company name |
| `address` | `Organization.address[0]` | Object | Company address |

### Coverage: Database → FHIR

| Your DB Field | FHIR Path | Format | Notes |
|--------------|-----------|---------|-------|
| `policy_number` | `Coverage.identifier[0].value` | String | Insurance policy number |
| `member_id` | `Coverage.identifier[1].value` | String | Member ID (optional) |
| `coverage_type` | `Coverage.type.coding[0].code` | Code | 'EHCPOL', etc. |
| `relationship` | `Coverage.relationship.coding[0].code` | Code | 'self', 'spouse', 'child' |
| `dependent_number` | `Coverage.dependent` | String | Dependent number |
| `plan_name` | `Coverage.class[0].name` | String | Plan name |
| `network_type` | `Coverage.network` | String | Network identifier |

### Eligibility Request: Form → FHIR

| Form Input | FHIR Path | Options |
|-----------|-----------|---------|
| Purpose checkboxes | `CoverageEligibilityRequest.purpose[]` | ['discovery', 'benefits', 'validation'] |
| Service date | `CoverageEligibilityRequest.servicedPeriod` | Start/end dates |

### Eligibility Response: FHIR → Database

| FHIR Path | DB Field | Notes |
|-----------|----------|-------|
| `CoverageEligibilityResponse.outcome` | `outcome` | 'complete', 'error', 'queued' |
| `CoverageEligibilityResponse.identifier[0].value` | `nphies_response_id` | Response ID |
| `CoverageEligibilityResponse.insurance[0].inforce` | `inforce` | Coverage active? |
| `CoverageEligibilityResponse.insurance[0].item[]` | `benefits` (JSON) | Array of benefits |
| `CoverageEligibilityResponse.error[]` | `error_codes` (JSON) | Array of errors |
| Full response bundle | `raw_response` (JSONB) | For audit/debugging |

---

## Code Structure

### File Structure
```
backend/
├── services/
│   ├── nphiesMapper.js          (NEW - Data transformation)
│   ├── nphiesService.js         (NEW - API communication)
│   └── chatService.js           (existing)
├── controllers/
│   ├── eligibilityController.js (UPDATE - Add nphies methods)
│   └── ...
├── routes/
│   ├── eligibility.js           (UPDATE - Add nphies routes)
│   └── ...
├── utils/
│   ├── nphiesValidator.js       (NEW - Validate FHIR bundles)
│   └── nphiesErrors.js          (NEW - Error code mappings)
└── .env
```

### Implementation Order

1. **nphiesMapper.js** - Pure data transformation (no API calls)
2. **nphiesService.js** - API communication
3. **nphiesValidator.js** - Validation utilities
4. **nphiesErrors.js** - Error handling
5. **eligibilityController.js** - Integrate into controller
6. **routes/eligibility.js** - Add routes
7. **Frontend updates** - Update forms

---

## Testing

### Test Environments

#### 1. OBA Test Environment
- **URL**: `http://176.105.150.83/$process-message`
- **No OAuth required** (for initial testing)
- **Use sample IDs** from nphies documentation

#### 2. nphies Sandbox
- **URL**: `https://hsb-sandbox.nphies.sa/$process-message`
- **Requires OAuth** with sandbox credentials
- **Use test data** provided by nphies

#### 3. Production
- **URL**: `https://hsb.nphies.sa/$process-message`
- **Requires OAuth** with production credentials
- **Real data only** after certification

### Test Cases

#### Test Case 1: Valid Eligibility Check
**Input:**
- Valid patient with National ID
- Valid provider nphies ID
- Valid insurer nphies ID
- Valid policy number
- Purpose: ['benefits', 'validation']

**Expected Output:**
- HTTP 200
- outcome: 'complete'
- inforce: true or false
- Benefits array (if purpose includes 'benefits')

#### Test Case 2: Invalid Coverage
**Input:**
- Valid patient
- Invalid or expired policy number

**Expected Output:**
- HTTP 200
- outcome: 'error'
- error[]: Contains error codes explaining why

#### Test Case 3: Queued Response
**Input:**
- Valid request when insurer is offline

**Expected Output:**
- HTTP 200
- outcome: 'queued'
- Will need to poll later for actual result

#### Test Case 4: Missing Required Fields
**Input:**
- Patient without identifier
- OR Provider without nphies_id

**Expected Output:**
- HTTP 400 (from your validation)
- OR HTTP 200 with outcome:'error' from nphies

### Testing with RestFox/Postman

#### Request Template
```
POST http://localhost:3000/api/eligibility/check-nphies

Headers:
  Content-Type: application/json
  Authorization: Bearer <your_token>

Body:
{
  "patientId": 1,
  "providerId": 1,
  "insurerId": 1,
  "purpose": ["benefits", "validation"],
  "serviceDate": "2025-11-23"
}
```

#### Expected Response
```json
{
  "success": true,
  "eligibilityId": 123,
  "outcome": "complete",
  "coverageActive": true,
  "patient": {
    "name": "Ahmad Abbas",
    "identifier": "2234567890"
  },
  "insurer": {
    "name": "Bupa Arabia"
  },
  "coverage": {
    "policyNumber": "POL123456",
    "type": "Extended Healthcare"
  },
  "benefits": [
    {
      "category": "Medical",
      "network": "In-Network",
      "allowed": 5000.00,
      "used": 1200.00,
      "remaining": 3800.00
    }
  ],
  "nphiesResponseId": "539"
}
```

---

## Error Handling

### Common nphies Error Codes

| Code | Meaning | Action |
|------|---------|--------|
| GE-00013 | Invalid JSON | Fix JSON format |
| RE-00062 | Invalid coverage reference | Check policy number |
| RE-00170 | Invalid profile | Check resource structure |
| GE-00001 | Invalid provider ID | Verify nphies_id |
| GE-00002 | Invalid insurer ID | Verify insurer nphies_id |
| BE-00001 | Patient not covered | Coverage not active |

### Error Response Structure
```json
{
  "success": false,
  "error": "Eligibility check failed",
  "details": {
    "outcome": "error",
    "errors": [
      {
        "code": "RE-00062",
        "message": "Coverage reference is invalid",
        "field": "insurance[0].coverage"
      }
    ]
  },
  "nphiesResponseId": "539"
}
```

### Handling Different Outcomes

#### outcome: 'complete'
- Success! Process benefits and save to DB

#### outcome: 'error'
- Parse error codes
- Return user-friendly messages
- Save for debugging

#### outcome: 'queued'
- Message is pending
- Implement polling mechanism (optional)
- Or notify user to check later

#### outcome: 'partial'
- Some items processed, others pending
- Handle partial results

---

## Production Checklist

### Before Going Live

- [ ] **Database Migration**: Run all SQL migrations on production DB
- [ ] **Environment Variables**: Set production nphies credentials
- [ ] **nphies IDs**: Ensure all providers/insurers have valid nphies IDs
- [ ] **Patient Data**: Ensure all patients have valid identifiers
- [ ] **Coverage Data**: Populate patient_coverage table
- [ ] **Testing**: Complete all test cases in sandbox
- [ ] **Certification**: Get nphies approval/certification
- [ ] **Error Monitoring**: Set up logging for nphies errors
- [ ] **Rate Limiting**: Implement request throttling if needed
- [ ] **Backup**: Backup database before deployment
- [ ] **Rollback Plan**: Prepare rollback procedure

### Security Considerations

- [ ] Never expose Client Secret in frontend
- [ ] Store credentials in secure vault (not plain .env)
- [ ] Use HTTPS only in production
- [ ] Implement request authentication
- [ ] Log all nphies requests/responses for audit
- [ ] Mask sensitive data in logs (patient IDs, policy numbers)
- [ ] Set appropriate CORS policies
- [ ] Rate limit your API endpoints

### Performance Optimization

- [ ] Cache OAuth tokens (expires in 1 hour)
- [ ] Implement connection pooling for nphies API
- [ ] Add database indexes on frequently queried fields
- [ ] Consider async/background processing for non-urgent checks
- [ ] Monitor API response times
- [ ] Set up alerts for nphies API failures

---

## Additional Resources

### Official Documentation
- nphies IG: https://portal.nphies.sa/ig/
- Eligibility Use Case: https://portal.nphies.sa/ig/usecase-eligibility.html
- FHIR Resources: https://portal.nphies.sa/ig/artifacts.html
- Developer Portal: https://portal.nphies.sa/developer/

### Support
- Email: support@nphies.sa
- Portal: https://portal.nphies.sa (after registration)

### Sample Files
- Example eligibility request: https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.json.html
- Example eligibility response: https://portal.nphies.sa/ig/Bundle-43c68545-8e37-4744-b8ea-9a1e3c1ada84.json.html

---

## Implementation Timeline Estimate

- **Day 1-2**: Database changes, environment setup
- **Day 3-5**: Implement nphiesMapper.js
- **Day 6-7**: Implement nphiesService.js
- **Day 8-9**: Update controllers and routes
- **Day 10-12**: Testing with OBA environment
- **Day 13-14**: Frontend integration
- **Day 15-20**: Sandbox testing and fixes
- **Day 21-25**: Certification with nphies
- **Day 26-30**: Production deployment and monitoring

Total: **~4-6 weeks** depending on complexity and nphies response times.

---

## Next Steps

1. Review this guide with your team
2. Get nphies credentials (if not already done)
3. Run database migrations
4. Start implementation with nphiesMapper.js
5. Test each component independently
6. Integrate and test end-to-end
7. Deploy to production

---

## Notes for Agent/Developer

- Follow the implementation order strictly
- Test each layer independently before integration
- Keep raw FHIR requests/responses for debugging
- Handle all error cases gracefully
- Document any deviations from this guide
- Update this guide as you learn more

Good luck with implementation! 🚀

