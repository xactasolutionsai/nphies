# 🎯 NPHIES API Testing - Guaranteed Working Combination

## ⭐ Use This Exact Combination for API Success!

After importing the seed data (`seed_nphies_test_data.sql`), use these **EXACT** selections in the NPHIES Eligibility page:

### ✅ Working Combination (NPHIES Official Example):

| Field | Select This Value | Why |
|-------|------------------|-----|
| **Patient** | **Ahmad Abbas** (2234567890) | Official NPHIES example patient |
| **Provider** | **King Fahad Specialist Hospital** | Official NPHIES example provider |
| **Insurer** | **Bupa Arabia Insurance Company** | Official NPHIES example insurer |
| **Coverage** | **POL-123456 - Premium Health Plan** | Official NPHIES example policy |
| **Purpose** | ☑ benefits ☑ validation | Standard eligibility check |
| **Service Date** | Today's date | Current date |

---

## 🚀 Step-by-Step Test

### 1. Import Seed Data
```sql
-- In pgAdmin, run:
backend/migrations/seed_nphies_test_data.sql
```

### 2. Navigate to NPHIES Eligibility Page
Open your application and go to: **NPHIES Eligibility**

### 3. Fill the Form

**Patient Dropdown:**
- Select: **Ahmad Abbas** 
- You'll see: `Ahmad Abbas - 2234567890`

**Provider Dropdown:**
- Select: **King Fahad Specialist Hospital**
- NPHIES ID shown: `(provider-license)`

**Insurer Dropdown:**
- Select: **Bupa Arabia Insurance Company**
- NPHIES ID shown: `(payer-license)`

**Coverage Dropdown** (Auto-populates after patient selection):
- Select: **POL-123456 - Premium Health Plan (Bupa Arabia Insurance Company)**

**Purpose Checkboxes:**
- ☑ Check: **benefits**
- ☑ Check: **validation**
- ☐ Leave unchecked: **discovery** (optional)

**Service Date:**
- Use today's date or: `2025-11-24`

### 4. Submit

Click: **"Check Eligibility"**

### 5. Wait for Response

- Loading spinner appears
- Backend sends request to: `http://176.105.150.83/$process-message`
- Response typically takes 10-60 seconds

### 6. Success! ✅

You should see:

**Coverage Status:**
- Status: **In Force (Eligible)** or similar
- Patient: Ahmad Abbas (2234567890)
- Policy: POL-123456

**Benefits Details** (if available):
- Various benefit categories
- Allowed/Used/Remaining amounts

**Raw FHIR Data:**
- Click to expand request/response
- Full FHIR Bundle visible

---

## 🔍 Backend Console Logs

Watch for these in your backend console:

```
[NPHIES] Building eligibility request bundle...
[NPHIES] Sending request to NPHIES API...
[NPHIES] Sending eligibility request (attempt 1/3)
[NPHIES] Response received: 200
[NPHIES] Parsing response...
[NPHIES] Eligibility check completed. ID: [uuid]
```

---

## ❌ Other Combinations May Not Work

The other test data (Arabic names, different policy numbers) is included for:
- UI testing
- Dropdown variety
- Demonstration purposes

But these **may NOT work** with the NPHIES OBA API because:
- NPHIES doesn't recognize those policy numbers
- Those aren't registered in their test system
- Only the official example data is guaranteed to work

### Example of Data That May Fail:
- Patient: أحمد محمد العلي (2234567891) ← Arabic name
- Policy: POL-BUPA-001 ← Not in NPHIES system
- Policy: POL-SI-002 ← Not in NPHIES system

**These are fine for:**
- Testing UI functionality
- Dropdown appearance
- Form validation

**But use Ahmad Abbas + POL-123456 for actual NPHIES API testing!**

---

## 🎯 Quick Reference Card

```
╔══════════════════════════════════════════════════╗
║   NPHIES API Test - Copy This Combination!      ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  👤 Patient:   Ahmad Abbas (2234567890)         ║
║  🏥 Provider:  King Fahad Specialist Hospital   ║
║  🛡️  Insurer:   Bupa Arabia Insurance Company   ║
║  📋 Policy:    POL-123456                        ║
║  ☑️  Purpose:   benefits + validation            ║
║  📅 Date:      Today                             ║
║                                                  ║
║  ✅ This combination WILL WORK with NPHIES!     ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

---

## 📊 Database Query to Find NPHIES Example

If you want to verify the data is imported correctly:

```sql
-- Find the NPHIES official example patient and coverage
SELECT 
    p.name as patient_name,
    p.identifier,
    pr.provider_name,
    pr.nphies_id as provider_nphies_id,
    i.insurer_name,
    i.nphies_id as insurer_nphies_id,
    pc.policy_number,
    pc.member_id,
    pc.plan_name,
    pc.is_active
FROM patients p
JOIN patient_coverage pc ON p.patient_id = pc.patient_id
JOIN insurers i ON pc.insurer_id = i.insurer_id
CROSS JOIN providers pr
WHERE p.identifier = '2234567890'
  AND pc.policy_number = 'POL-123456'
  AND i.nphies_id = 'payer-license'
  AND pr.nphies_id = 'provider-license';
```

**Expected Result:**
```
patient_name: Ahmad Abbas
identifier: 2234567890
provider_name: King Fahad Specialist Hospital
provider_nphies_id: provider-license
insurer_name: Bupa Arabia Insurance Company
insurer_nphies_id: payer-license
policy_number: POL-123456
member_id: MEM-123456
plan_name: Premium Health Plan
is_active: true
```

---

## 🎉 Ready to Test!

1. ✅ Import seed data
2. ✅ Use Ahmad Abbas + POL-123456 combination
3. ✅ Submit to NPHIES
4. ✅ Get real API response!

**This is the guaranteed working combination!** 🚀

