# NPHIES API Flow - How It Works

## 🔄 Request Flow Diagram

```
Frontend                Backend                    NPHIES OBA API
   |                       |                              |
   |  1. Click Button      |                              |
   |---------------------->|                              |
   |                       |                              |
   |                       | 2. Build FHIR Bundle         |
   |                       |   (nphiesMapper.js)          |
   |                       |                              |
   |                       | 3. POST Request              |
   |                       |----------------------------->|
   |                       |    http://176.105.150.83/    |
   |                       |    $process-message          |
   |                       |                              |
   |                       |    Content-Type:             |
   |                       |    application/fhir+json     |
   |                       |                              |
   |                       | 4. FHIR Response             |
   |                       |<-----------------------------|
   |                       |                              |
   |                       | 5. Parse Response            |
   |                       |   (nphiesMapper.js)          |
   |                       |                              |
   |  6. Display Results   |                              |
   |<----------------------|                              |
   |                       |                              |
```

## 📋 Two Ways to Test

### Option 1: Using Database Records (Regular Flow)

**Frontend → Backend → NPHIES**

1. **Select from dropdowns:**
   - Patient (from database)
   - Provider (from database)
   - Insurer (from database)
   - Coverage (from database)
   - Purpose checkboxes
   - Service date

2. **Click "Check Eligibility"**

3. **Backend Process:**
   - Fetches data from database
   - Builds FHIR bundle using `nphiesMapper.js`
   - Sends POST to `http://176.105.150.83/$process-message`
   - Receives response from NPHIES
   - Parses and saves to database
   - Returns result to frontend

4. **Frontend displays:**
   - Coverage status
   - Benefits
   - Raw FHIR data

**Backend Code Path:**
```
POST /api/eligibility/check-nphies
  ↓
eligibilityController.checkNphiesEligibility()
  ↓
nphiesMapper.buildEligibilityRequestBundle()
  ↓
nphiesService.checkEligibility()
  ↓
axios.post('http://176.105.150.83/$process-message')
  ↓
Response from NPHIES OBA API
```

### Option 2: Using Example Bundle (Direct Test)

**Frontend → Backend → NPHIES** (with example data)

1. **Click "Load NPHIES Example Data"**
   - Loads official NPHIES example bundle
   - Shows "Example Loaded" badge

2. **Click "Send Example to NPHIES"**
   - Sends pre-built FHIR bundle directly
   - No database records needed
   - Perfect for initial testing

3. **Backend Process:**
   - Receives pre-built bundle
   - Sends directly to `http://176.105.150.83/$process-message`
   - No data fetching or mapping needed
   - Returns response

4. **Frontend displays:**
   - Same result format
   - Shows example patient data
   - Raw FHIR request/response

**Backend Code Path:**
```
POST /api/eligibility/check-nphies-direct
  ↓
eligibilityController.checkNphiesExampleDirect()
  ↓
nphiesService.checkEligibility(exampleBundle)
  ↓
axios.post('http://176.105.150.83/$process-message')
  ↓
Response from NPHIES OBA API
```

## 🎯 NPHIES API Details

**Endpoint:** `http://176.105.150.83/$process-message`

**Method:** POST

**Headers:**
```
Content-Type: application/fhir+json
Accept: application/fhir+json
```

**Request Body:** FHIR Bundle (type: message)
```json
{
  "resourceType": "Bundle",
  "type": "message",
  "timestamp": "2025-11-24T...",
  "entry": [
    { "resource": { "resourceType": "MessageHeader", ... } },
    { "resource": { "resourceType": "CoverageEligibilityRequest", ... } },
    { "resource": { "resourceType": "Patient", ... } },
    { "resource": { "resourceType": "Coverage", ... } },
    { "resource": { "resourceType": "Organization", ... } },
    ...
  ]
}
```

**Response Body:** FHIR Bundle with CoverageEligibilityResponse

## 🧪 Testing Checklist

### Step 1: Test with Example Bundle (Easiest)
- [ ] Click "Load NPHIES Example Data"
- [ ] See "Example Loaded" badge
- [ ] Click "Send Example to NPHIES"
- [ ] Wait for response (may take 10-60 seconds)
- [ ] Check backend console for logs
- [ ] Verify response displays on screen

**Expected Console Logs (Backend):**
```
[NPHIES] Sending example bundle directly to NPHIES API...
[NPHIES] Target: http://176.105.150.83/$process-message
[NPHIES] Sending eligibility request (attempt 1/3)
[NPHIES] Response received: 200
[NPHIES] Response received from OBA API
```

### Step 2: Test with Database Records
- [ ] Run UUID migration script first
- [ ] Verify sample data exists in database
- [ ] Select patient, provider, insurer, coverage
- [ ] Click "Check Eligibility"
- [ ] Wait for response
- [ ] Verify database shows saved record

**Expected Console Logs (Backend):**
```
[NPHIES] Building eligibility request bundle...
[NPHIES] Sending request to NPHIES API...
[NPHIES] Sending eligibility request (attempt 1/3)
[NPHIES] Response received: 200
[NPHIES] Parsing response...
[NPHIES] Eligibility check completed. ID: [uuid]
```

## 🔍 Verifying the Request is Sent

### Check Backend Console
When you click either button, you should see:
```
[NPHIES] Sending eligibility request (attempt 1/3)
POST http://176.105.150.83/$process-message
[NPHIES] Response received: 200
```

### Check Browser Console (F12)
```
Submitting eligibility request: {patientId: "...", ...}
Request will be sent to backend, which forwards to: http://176.105.150.83/$process-message
Response received from NPHIES: {...}
```

### Check Network Tab (F12)
You should see:
1. **Request to backend:**
   - URL: `http://localhost:8001/api/eligibility/check-nphies` or `/check-nphies-direct`
   - Method: POST
   - Status: 200

2. **Backend makes request to NPHIES:**
   - URL: `http://176.105.150.83/$process-message`
   - This happens server-side (you won't see it in browser network tab)

## 🐛 Troubleshooting

### "No response from NPHIES"
**Cause:** OBA server might be slow or down  
**Solution:** 
- Check backend console for timeout errors
- Try again (automatic retry up to 3 times)
- Verify endpoint is accessible: `curl http://176.105.150.83`

### "Request failed with 400"
**Cause:** Invalid FHIR bundle structure  
**Solution:**
- Use example bundle first (known to be valid)
- Check backend console for validation errors
- Verify all required FHIR resources are included

### "Request failed with 500"
**Cause:** Server error on NPHIES side  
**Solution:**
- Check raw response in results display
- Look for OperationOutcome with error details
- Try example bundle to verify API is working

### "Connection timeout"
**Cause:** Network issue or firewall  
**Solution:**
- Check if `http://176.105.150.83` is accessible
- Verify no proxy/firewall blocking the request
- Try increasing timeout in `backend/env.example` (NPHIES_TIMEOUT)

## 📝 Key Files

**Frontend:**
- `frontend/src/pages/NphiesEligibility.jsx` - UI and button handlers
- `frontend/src/data/nphiesExampleBundle.json` - Example FHIR bundle

**Backend:**
- `backend/services/nphiesService.js` - HTTP client for NPHIES API
- `backend/services/nphiesMapper.js` - FHIR bundle builder/parser
- `backend/controllers/eligibilityController.js` - Request handlers
- `backend/routes/eligibility.js` - API endpoints

## ✅ Success Indicators

You'll know it's working when:
1. ✅ Backend console shows "Sending eligibility request"
2. ✅ Backend console shows "Response received: 200"
3. ✅ Frontend displays results within 10-60 seconds
4. ✅ Raw FHIR response is viewable (click to expand)
5. ✅ No timeout or connection errors

## 🎉 Ready to Test!

1. **Start backend:** `cd backend && npm start`
2. **Start frontend:** `cd frontend && npm run dev`
3. **Navigate to:** NPHIES Eligibility page
4. **Click:** "Load NPHIES Example Data"
5. **Click:** "Send Example to NPHIES"
6. **Watch:** Backend console and frontend for response
7. **Success!** 🚀

The request IS going to NPHIES at `http://176.105.150.83/$process-message` - you just need to test it!

