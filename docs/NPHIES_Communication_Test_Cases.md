# NPHIES Communication Test Cases

This document provides step-by-step instructions for testing the two NPHIES communication scenarios implemented in the system.

---

## Prerequisites

Before testing, ensure you have:
1. A valid **Patient** with coverage information
2. A valid **Provider** with NPHIES ID configured
3. A valid **Insurer** with NPHIES ID configured
4. At least one **Service/Procedure** code ready to use

---

## Test Case #1: Institutional Authorization with Unsolicited Communication

### Scenario Overview
The Healthcare Provider (HCP) submits an Institutional Prior Authorization request, receives a "queued/pended" response, and then proactively sends additional clinical information (unsolicited communication) to the Health Insurance Company (HIC).

### Flow Diagram
```
HCP → NPHIES: Send Institutional Auth (priority=deferred)
NPHIES → HCP: Queued/Pended Response
HCP → NPHIES: Send Unsolicited Communication (proactive)
HCP → NPHIES: Poll for messages
NPHIES → HCP: Communication Acknowledgment
HIC → NPHIES: Adjudicate & send AuthorizationResponse
HCP → NPHIES: Poll for final response
NPHIES → HCP: Completed AuthorizationResponse
```

### Step-by-Step Instructions

#### Step 1: Create Institutional Prior Authorization

1. **Navigate to:** `Prior Authorizations` → `Create New`
   - URL: `/prior-authorizations/new`

2. **Fill Basic Information Tab:**
   - **Authorization Type:** Select `Institutional`
   - **Sub Type:** Select `Inpatient (ip)` or `Outpatient (op)`
   - **Priority:** Select `Deferred` ⚠️ (Important for queued response)
   - **Patient:** Select a patient with valid coverage
   - **Provider:** Select your provider
   - **Insurer:** Auto-filled from coverage or select manually

3. **Fill Encounter Tab:**
   - **Encounter Class:** Select appropriate class (e.g., `IMP` for Inpatient)
   - **Admission Date:** Set start date (required)
   - **Discharge Date:** Set end date (optional)
   - **Service Type:** Select service type

4. **Fill Items Tab:**
   - Click `+ Add Item`
   - **Service/Procedure Code:** Select a procedure code
   - **Quantity:** Enter quantity (e.g., 1)
   - **Unit Price:** Enter price
   - ✅ **Check "Package Item"** (at least one item should be a package)
   
5. **Fill Diagnoses Tab:**
   - Add at least one diagnosis with ICD-10 code
   - Set diagnosis type (e.g., `admitting`, `principal`)

6. **Fill Supporting Info Tab:**
   - **Vital Signs:** Add vital signs (Systolic, Diastolic, Height, Weight)
     - Click "Generate Sample Vitals" for quick test data
   - **Chief Complaint:** Add chief complaint
     - Can be ICD code OR free text
     - Example: "Chest pain" or SNOMED code `29857009`

7. **Save & Submit:**
   - Click `Save Draft` first
   - Then click `Send to NPHIES`

8. **Expected Response:**
   - Status should change to `Queued`
   - Outcome should show `Pended`
   - You should see the **Communications Tab** appear

---

#### Step 2: Send Unsolicited Communication

1. **Navigate to Communications Tab:**
   - After receiving queued response, go to the PA details page
   - URL: `/prior-authorizations/{id}`
   - Click on the **"Communications"** tab (appears only for queued PAs)

2. **Compose Unsolicited Communication:**
   - Click `+ Compose New Communication`
   - **Communication Type:** Select `Unsolicited (Proactive)`
   - **Category:** Select appropriate category:
     - `Instruction` - Additional instructions for the insurer
     - `Notification` - Notify about patient status
     - `Alert` - Alert about urgent information
     - `Reminder` - Reminder about pending items
   - **Priority:** Select `Routine` (or `Urgent` if needed)
   - **Content Type:** Select `Free Text`
   - **Message Content:** Enter your message, e.g.:
     ```
     Additional clinical information regarding the patient's condition.
     The patient requires immediate admission due to acute symptoms.
     Lab results attached for reference.
     ```
   - **Reference Items (Optional):** Check items this communication relates to
     - This adds `ClaimItemSequence` extension to the communication

3. **Send Communication:**
   - Click `Send Communication`
   - Wait for confirmation

---

#### Step 3: Poll for Acknowledgment

1. **Poll for Updates:**
   - In the Communications tab, click `Poll for Updates`
   - This checks for:
     - Communication acknowledgments
     - New CommunicationRequests from HIC
     - Final ClaimResponse

2. **View Results:**
   - **Communication History** section shows sent communications
   - Status should update to show acknowledgment received
   - If final response received, PA status updates accordingly

---

## Test Case #2: Professional Authorization with Solicited Communication

### Scenario Overview
The HCP submits a Professional Prior Authorization, receives a "queued" response along with a CommunicationRequest from the HIC asking for additional information. The HCP then responds with a solicited communication.

### Flow Diagram
```
HCP → NPHIES: Send Eligibility Request (optional)
HCP → NPHIES: Send Professional Auth (priority=deferred, eligibility ref)
NPHIES → HCP: Queued/Pended Response
HCP → NPHIES: Poll for messages
NPHIES → HCP: CommunicationRequest from HIC (asking for info)
HCP → NPHIES: Send Solicited Communication (response with basedOn)
HCP → NPHIES: Poll for acknowledgment
NPHIES → HCP: Communication Acknowledgment
HCP → NPHIES: Poll for final response
NPHIES → HCP: Completed AuthorizationResponse
```

### Step-by-Step Instructions

#### Step 1: (Optional) Create Eligibility Request

1. **Navigate to:** `Eligibility` → `Create New`
   - URL: `/eligibility/new`

2. **Submit Eligibility Check:**
   - Select Patient
   - Select Provider
   - Select Insurer
   - Submit and note the Eligibility Reference ID

---

#### Step 2: Create Professional Prior Authorization

1. **Navigate to:** `Prior Authorizations` → `Create New`
   - URL: `/prior-authorizations/new`

2. **Fill Basic Information Tab:**
   - **Authorization Type:** Select `Professional`
   - **Sub Type:** Select appropriate subtype
   - **Priority:** Select `Deferred` ⚠️
   - **Patient:** Select patient
   - **Provider:** Select provider
   - **Eligibility Reference:** (Optional) Enter eligibility reference from Step 1

3. **Fill Items Tab:** ⚠️ **IMPORTANT: Use NPHIES Lab Service codes (NOT LOINC)**
   
   Per NPHIES IG, `Claim.item.productOrService` MUST use NPHIES service codes:
   - **Code System:** Select `NPHIES Lab Services` from the dropdown
   - **Service/Procedure Code:** Select a NPHIES lab service code:
     - `91.03` - Urinalysis
     - `91.05` - Clinical chemistry (blood)
     - `91.06` - Hematology (blood)
     - `91.07` - Microbiology
     - `91.09` - Pathology examination
   - Set quantities and prices
   - Add at least 1 lab service item (required for Test Case #2)

4. **Fill Lab Observations Tab:** ⚠️ **IMPORTANT: LOINC codes go here**
   
   Per NPHIES IG, lab test details MUST be in `Observation` resources with LOINC codes:
   - Click `+ Add Lab Observation`
   - **LOINC Code:** Select one of the required codes:
     - `80096-1` - Microalbumin/Creatinine [Ratio] in Urine
     - `43863-0` - Urine specimen collection method
     - `55951-8` - Urine sediment comments by Light microscopy
     - `12419-8` - Sodium [Moles/volume] in Urine
   - **Status:** Select `registered` (pending test)
   - **Notes:** Add clinical notes if needed
   - These observations are linked to the Claim via `supportingInfo` with `category = laboratory`

5. **Fill Diagnoses Tab:**
   - Add relevant diagnoses

6. **Save & Submit:**
   - Save draft
   - Send to NPHIES

7. **Expected Response:**
   - Status: `Queued`
   - Communications tab appears

---

#### Step 3: Poll for CommunicationRequest

1. **Navigate to Communications Tab:**
   - Go to PA details: `/prior-authorizations/{id}`
   - Click **"Communications"** tab

2. **Poll for Updates:**
   - Click `Poll for Updates`
   - Check **"Pending Requests from Insurer"** section

3. **View CommunicationRequest:**
   - If HIC sent a request, it appears in the pending requests list
   - Shows:
     - Request ID
     - Date received
     - Category/Type of information requested
     - Any specific instructions from HIC

---

#### Step 4: Send Solicited Communication (Response)

1. **Respond to Request:**
   - In the **"Pending Requests from Insurer"** section
   - Click `Respond` on the CommunicationRequest

2. **Compose Response:** ⚠️ **IMPORTANT: Attachment is REQUIRED for Test Case #2**
   - **Communication Type:** Automatically set to `Solicited (Response to Request)`
   - **Responding to Request:** Shows the selected CommunicationRequest
   - **Category:** Select appropriate category (e.g., `Notification` or `Instruction`)
   - **Priority:** Match the request priority or set appropriately
   - **Content Type:** Select `Attachment` ⚠️ (Required for Test Case #2)
     - Upload supporting documents (PDF, images, lab reports)
   - **Reference Items:** Select relevant claim items (especially the LOINC lab items)

3. **Send Response:**
   - Click `Send Communication`
   - The response includes `basedOn` reference to the original CommunicationRequest

---

#### Step 5: Poll for Final Response

1. **Continue Polling:**
   - Click `Poll for Updates` periodically
   - Check for:
     - Communication acknowledgment
     - Final ClaimResponse

2. **Final Status:**
   - When HIC completes adjudication, status updates to:
     - `Approved` - Authorization granted
     - `Denied` - Authorization rejected
     - `Partial` - Partial approval

---

## UI Navigation Summary

| Action | Navigation Path |
|--------|-----------------|
| Create New PA | Sidebar → Prior Authorizations → + Create New |
| View PA Details | Prior Authorizations List → Click on PA row |
| Communications Tab | PA Details → Communications tab (visible for queued PAs) |
| Poll for Updates | Communications Tab → "Poll for Updates" button |
| Compose Communication | Communications Tab → "+ Compose New Communication" |
| View History | Communications Tab → "Communication History" section |

---

## Communication Categories Reference

| Category | Use Case |
|----------|----------|
| `instruction` | Providing instructions or clinical guidance |
| `notification` | General notifications about patient/case status |
| `alert` | Urgent alerts requiring attention |
| `reminder` | Reminders about pending actions |

---

## Priority Levels Reference

| Priority | Description |
|----------|-------------|
| `routine` | Normal processing time |
| `urgent` | Requires expedited handling |
| `asap` | As soon as possible |
| `stat` | Immediate attention required |

---

## Troubleshooting

### Communications Tab Not Visible
- **Cause:** PA is not in `queued` status
- **Solution:** The Communications tab only appears when:
  - `status = 'queued'` OR
  - `outcome = 'queued'` OR
  - `adjudication_outcome = 'pended'`

### Poll Returns No Results
- **Cause:** No pending messages from NPHIES
- **Solution:** Wait and poll again, or check PA status

### Communication Send Failed
- **Cause:** Missing required fields or network error
- **Solution:** Check all required fields are filled, verify network connectivity

### "Column does not exist" Error
- **Cause:** Database schema mismatch
- **Solution:** Run latest migrations: `npm run migrate`

---

## Sample Test Data

### Vital Signs (for Institutional)
```json
{
  "systolic": { "value": 120, "unit": "mm[Hg]" },
  "diastolic": { "value": 80, "unit": "mm[Hg]" },
  "height": { "value": 175, "unit": "cm" },
  "weight": { "value": 70, "unit": "kg" }
}
```

### Chief Complaint Examples
- Free Text: `"Patient presents with acute chest pain and shortness of breath"`
- SNOMED Code: `29857009` (Chest pain)

### Communication Message Example
```
Additional Clinical Information:

Patient Name: [Patient Name]
Date of Service: [Date]

Clinical Notes:
- Patient admitted with acute symptoms
- Lab results indicate elevated markers
- Immediate intervention recommended

Attachments:
- Lab Results (attached)
- Imaging Report (attached)

Please expedite review.
```

---

## API Endpoints Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/prior-authorizations/:id/poll` | GET | Poll for NPHIES updates |
| `/api/prior-authorizations/:id/communications` | GET | Get all communications |
| `/api/prior-authorizations/:id/communication-requests` | GET | Get pending requests |
| `/api/prior-authorizations/:id/communications/unsolicited` | POST | Send unsolicited communication |
| `/api/prior-authorizations/:id/communication-requests/:reqId/respond` | POST | Send solicited communication |

---

*Document Version: 1.0*
*Last Updated: December 2024*

