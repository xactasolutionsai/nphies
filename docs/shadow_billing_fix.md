# Shadow Billing Validation Issue & Fix (NPHIES)

## 1. Issue Summary

When submitting a claim or prior authorization with Shadow Billing enabled, the system returns:

IB-00238  
Element SHALL have a valid code from the assigned valueSet

This error indicates that a code sent in the request does not comply with the required NPHIES value set validation.

---

## 2. Root Cause

The backend is incorrectly assigning a **user-entered (invalid) code** to a **NPHIES code system**.

### ❌ Incorrect Implementation

```json
{
  "coding": [
    {
      "code": "4444444",
      "system": "http://nphies.sa/terminology/CodeSystem/laboratory"
    },
    {
      "code": "73050-39-70",
      "system": "http://provider.com.sa/product-or-service"
    }
  ]
}

Problem:
4444444 is NOT a valid NPHIES code
It is incorrectly placed under a NPHIES system
NPHIES enforces strict validation against value sets
The request is rejected with IB-00238
3. Key Rule (Critical)

Any code sent under a NPHIES system MUST be a valid code from the official value set.

4. Correct Shadow Billing Structure

You must reverse the coding structure:

✅ Correct Implementation

{
  "coding": [
    {
      "code": "73050-39-70",
      "system": "http://nphies.sa/terminology/CodeSystem/laboratory"
    },
    {
      "code": "4444444",
      "system": "http://provider.com.sa/product-or-service"
    }
  ]
}

5. Concept Explanation
Code Type	System	Purpose
NPHIES Code	nphies.sa/...	Used for validation & adjudication
Provider Code	provider.com.sa/...	Internal tracking / audit

6. Backend Processing Flow
Input
{
  "code": "4444444",
  "type": "laboratory"
}

Processing Steps
Validate code using database lookup:
If found → valid NPHIES code → send normally
If NOT found → trigger Shadow Billing
Select Unlisted Code:
Example: 73050-39-70 (Laboratory default)
Build coding array:

if (!isValidNphiesCode(userCode)) {
  coding = [
    {
      code: unlistedCode,
      system: nphiesSystem
    },
    {
      code: userCode,
      system: providerSystem
    }
  ];
}
7. Required Code Fix
❌ Old Logic
coding = [
  originalCode,
  unlistedCode
];
✅ New Logic
coding = [
  { code: unlistedCode, system: nphiesSystem },
  { code: originalCode, system: providerSystem }
];
8. Validation Safeguard (Recommended)

Add a validation rule to prevent invalid codes in NPHIES systems:
if (system.includes('nphies.sa') && !isValidNphiesCode(code)) {
  throw new Error('Invalid NPHIES code used with NPHIES system');
}
9. Expected Result After Fix
IB-00238 error is resolved
Requests are accepted by NPHIES
Shadow Billing works correctly
Full compliance with NPHIES validation rules

10. Example Test Case
Input
Code: 4444444
Type: laboratory
Output
NPHIES Code: 73050-39-70
Provider Code: 4444444
Result

✔ Accepted by NPHIES
✔ Shadow Billing applied correctly

11. Final Conclusion

The issue was caused by assigning codes to the wrong system.

Fixing the system assignment (NPHIES vs Provider) completely resolves the issue and ensures proper Shadow Billing behavior.