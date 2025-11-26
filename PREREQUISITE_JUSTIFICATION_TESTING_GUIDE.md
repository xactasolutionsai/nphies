# Prerequisite Justification Popup - Testing Guide

## Implementation Summary

The prerequisite justification popup has been successfully implemented in the General Request form. When a user submits a request that requires prerequisites (e.g., MRI without X-Ray), a popup appears asking for justification.

## What Was Implemented

### 1. New Component: PrerequisiteJustificationPopup
**Location:** `frontend/src/components/general-request/PrerequisiteJustificationPopup.jsx`

**Features:**
- Displays missing prerequisites from both database and AI
- Distinguishes between DB requirements (blue) and AI recommendations (purple)
- Text area for justification (minimum 10 characters)
- Two action buttons:
  - "Submit with Justification" - proceeds with submission
  - "Cancel" - shows warning but allows retry
- Responsive modal design matching existing UI

### 2. Modified Component: GeneralRequestWizard
**Location:** `frontend/src/components/general-request/GeneralRequestWizard.jsx`

**Changes:**
- Added state management for popup and prerequisites
- Created `validatePrerequisites()` function to call backend API
- Modified `handleSubmit()` to validate before submission
- Added `handleJustificationSubmit()` to process justification
- Added `handlePrerequisiteCancel()` for cancel action
- Integrated PrerequisiteJustificationPopup component

### 3. Backend Integration
**API Endpoint:** `POST http://localhost:8001/api/general-request/validate`

The endpoint returns:
```json
{
  "traditional": {
    "requiresPrerequisites": true/false,
    "prerequisitesNeeded": "comma,separated,list",
    "fit": true/false,
    "diagnoses": []
  },
  "aiEnhanced": {
    "criticalPrerequisites": ["prerequisite1", "prerequisite2"],
    "prerequisiteChain": [
      {
        "order": 1,
        "testName": "X-Ray",
        "clinicalReason": "Initial imaging to assess...",
        "urgency": "routine"
      }
    ],
    "testAppropriate": true/false,
    "confidence": 0.85
  },
  "metadata": {
    "timestamp": "...",
    "bothSystemsRan": true
  }
}
```

## Testing Instructions

### Prerequisites
1. Backend server running on `http://localhost:8001`
2. Database with `medical_exams` table populated (run migration if needed)
3. Frontend development server running
4. Ollama running with AI model available

### Test Case 1: MRI Without X-Ray (Database Prerequisites)

**Steps:**
1. Navigate to General Request form
2. Fill out the form with:
   - Patient information (any valid data)
   - Coverage information
   - Provider information
   - **Service Request:**
     - Diagnosis: "Knee pain"
     - Service Description: "MRI"
     - Body Part: "Knee"
     - Previous Tests: Leave empty or enter something other than "X-Ray"
3. Complete the form through to Review step
4. Click "Submit Request"

**Expected Result:**
- Loading spinner appears briefly
- Validation API is called
- Popup appears showing:
  - **Required Prerequisites (Database)** section in blue
  - "Prior X-Ray or consultation notes"
- Justification text area is empty
- Two buttons: "Cancel" and "Submit with Justification"

**Test Actions:**
1. Try clicking "Submit with Justification" without entering text
   - Should show error: "Please provide a justification of at least 10 characters"
2. Enter less than 10 characters
   - Should show error message
3. Enter valid justification (10+ characters): "Emergency case, patient in severe pain"
4. Click "Submit with Justification"

**Expected Outcome:**
- Console logs justification and prerequisites
- Popup closes
- Form submits successfully
- Success message appears
- Form resets

### Test Case 2: Cancel Action

**Steps:**
1. Repeat Test Case 1 steps 1-4 to trigger popup
2. Click "Cancel" button

**Expected Result:**
- Popup closes
- Alert appears: "⚠️ Warning: Submission may be rejected without proper prerequisites..."
- Form remains filled (not submitted)
- User can edit form or try submitting again

### Test Case 3: AI Prerequisites

**Steps:**
1. Fill out form with:
   - Patient with multiple medications
   - Diagnosis: "Chest pain"
   - Service: "CT Scan with contrast"
   - Age: 65+
2. Submit the request

**Expected Result:**
- Popup may show both:
  - **Required Prerequisites (Database)** - e.g., "Blood creatinine level"
  - **AI-Recommended Prerequisites** - detailed test chain with clinical reasons
- AI prerequisites show in purple with more detail (order, clinical reason, urgency)

### Test Case 4: No Prerequisites Required

**Steps:**
1. Fill out form with:
   - Diagnosis: "Suspected fracture"
   - Service: "X-Ray"
   - Body Part: "Wrist"
2. Submit the request

**Expected Result:**
- No popup appears (X-Ray typically has no prerequisites)
- Form submits directly
- Success message appears

### Test Case 5: API Failure Handling

**Steps:**
1. Stop the backend server
2. Fill out form completely
3. Click "Submit Request"

**Expected Result:**
- Validation API call fails
- Error is caught and logged to console
- Form still submits (graceful degradation)
- No popup appears

## Console Logging

When a user provides justification, the following is logged to console:

```
=== PREREQUISITE OVERRIDE JUSTIFICATION ===
Justification: Emergency case, patient in severe pain
DB Prerequisites Bypassed: ["Prior X-Ray or consultation notes"]
AI Prerequisites Bypassed: [...]
==========================================
```

**Note:** This is fake storage for now. In production, this data should be:
- Sent to backend with submission
- Stored in database
- Included in approval workflow
- Visible to approvers

## Database Query for Testing

To verify database prerequisites, run this query:

```sql
SELECT exam_name, prerequisites, category
FROM medical_exams
WHERE prerequisites IS NOT NULL
ORDER BY exam_name;
```

Common exams with prerequisites:
- **MRI:** "Prior X-Ray or consultation notes"
- **CT Scan:** "Blood creatinine level, Prior relevant imaging"
- **MRI Spine:** "Prior X-Ray recommended"
- **Angiography:** "Blood creatinine level, Coagulation profile"

## Files Modified

1. ✅ `frontend/src/components/general-request/PrerequisiteJustificationPopup.jsx` (NEW)
2. ✅ `frontend/src/components/general-request/GeneralRequestWizard.jsx` (MODIFIED)

## Known Behaviors

1. **Justification is logged but not stored** - This is intentional for now
2. **Form submits even if validation API fails** - Graceful degradation prevents blocking users
3. **Warning on cancel allows retry** - User can try submitting again with or without justification
4. **Both DB and AI prerequisites shown together** - Provides comprehensive view
5. **Minimum 10 characters for justification** - Prevents trivial/empty justifications

## Future Enhancements

- [ ] Store justification in database with request
- [ ] Send justification to backend API
- [ ] Add justification review workflow
- [ ] Show justification in approval UI
- [ ] Track override statistics
- [ ] Add justification templates/suggestions
- [ ] Implement role-based override permissions

## Troubleshooting

### Popup doesn't appear
- Check if backend is running
- Check if medical_exams table exists
- Verify exam name matches database (case-insensitive)
- Check console for validation API errors

### Validation API fails
- Verify Ollama is running
- Check AI model is loaded
- Review backend logs for errors
- Check database connection

### Justification not logging
- Open browser console (F12)
- Check for JavaScript errors
- Verify handleJustificationSubmit is called

## Contact

For issues or questions about this implementation, refer to:
- Plan file: `prerequisite-justification-popup.plan.md`
- Backend validation: `backend/services/generalRequestValidationService.js`
- Database schema: `backend/migrations/create_medical_exams_table.sql`

