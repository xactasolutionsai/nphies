# NPHIES Claim Fix Prompt for AI Editor

This document contains a **ready-to-use prompt** for an AI code editor
(Cursor, Copilot, etc.) to automatically fix issues in the NPHIES
Professional Claim JSON according to the NPHIES Implementation Guide and
test case requirements.

------------------------------------------------------------------------

# Prompt for AI Editor

You are working with a **FHIR Bundle containing a NPHIES Professional
Claim**.

Update the JSON so it complies with the NPHIES test case requirements
and fix the following issues:

## 1. Fix Onset Supporting Info

Problem: The `supportingInfo` entry with category `onset` incorrectly
uses an ICD code.\
According to FHIR and NPHIES rules, onset must be represented as a
**date (timingDate)**.

Required Fix: Replace the incorrect structure:

``` json
{
  "category": {
    "coding": [
      {
        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category",
        "code": "onset"
      }
    ]
  },
  "code": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/icd-10-am",
        "code": "onset"
      }
    ]
  }
}
```

With:

``` json
{
  "category": {
    "coding": [
      {
        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category",
        "code": "onset"
      }
    ]
  },
  "timingDate": "YYYY-MM-DD"
}
```

------------------------------------------------------------------------

## 2. Ensure Claim Items Use Multiple Code Systems

Problem: All `Claim.item.productOrService` codes currently use the same
code system.

Test case requirement: The claim must contain **items from multiple code
systems** such as:

-   NPHIES procedures
-   LOINC
-   CPT
-   Drug codes
-   SFDA

Required Fix: Add at least one additional Claim item using a **different
coding system**.

Example:

``` json
{
  "sequence": 3,
  "productOrService": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "55951-8"
      }
    ]
  }
}
```

------------------------------------------------------------------------

## 3. Add Communication Resource to Bundle

Problem: The test scenario requires **unsolicited communication from HIC
referencing a claim item**, but the bundle currently does not contain a
`Communication` resource.

Required Fix: Add a `Communication` resource entry in the bundle that
references the claim.

Example structure:

``` json
{
  "resourceType": "Communication",
  "status": "completed",
  "payload": [
    {
      "contentString": "Additional information required for claim item"
    }
  ]
}
```

Ensure it is included as a **bundle entry**.

------------------------------------------------------------------------

## 4. Add ClaimItemSequence Extension

Problem: The communication must reference the claim item sequence that
requires clarification.

Required Fix: Inside `Communication.payload`, add the NPHIES extension:

``` json
{
  "extension": [
    {
      "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-claimItemSequence",
      "valuePositiveInt": 1
    }
  ]
}
```

This value must match the **Claim.item.sequence** being referenced.

------------------------------------------------------------------------

# Expected Result

After applying these fixes:

-   `supportingInfo.onset` uses `timingDate`
-   claim items come from **multiple code systems**
-   bundle contains a **Communication resource**
-   communication payload references the claim item via
    **ClaimItemSequence extension**

The bundle should then comply with the **NPHIES unsolicited
communication test case flow**.
