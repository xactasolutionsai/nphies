# Shadow Billing & Unlisted Codes -- Full Implementation Guide (NPHIES)

## Overview

This document provides a complete, production-level guide for
implementing: - Shadow Billing (dual coding) - Unlisted code handling -
Mapping logic - Full backend decision flow - Scenarios for all claim and
prior authorization types

This applies to: - Claims - Prior Authorizations (ALL types: Pharmacy,
Professional, Institutional, Dental, Vision)

------------------------------------------------------------------------

## 1. Core Concepts

### 1.1 Shadow Billing

Shadow Billing = sending BOTH: - Standard NPHIES code - Internal
(non-NPHIES) code

This applies to ALL types: - Pharmacy ✔ - Professional ✔ - Institutional
✔ - Dental ✔ - Vision ✔

------------------------------------------------------------------------

### 1.2 Unlisted Codes

Unlisted codes are used ONLY when: \> No valid mapping exists to a
NPHIES standard code with similar meaning.

Unlisted is ALWAYS: - Decided by backend - Based on type

------------------------------------------------------------------------

## 2. System Architecture

Frontend → Controller → Mapping Service → Mapper → FHIR JSON

------------------------------------------------------------------------

## 3. Full Backend Flow

### Step 1 -- Input

User provides: - Type (Lab / Imaging / Procedure / etc.) - Code (manual
or selected) - Description (optional)

------------------------------------------------------------------------

### Step 2 -- Mapping Lookup

function findMapping(code) { // lookup in DB }

------------------------------------------------------------------------

### Step 3 -- Decision Logic

IF mapping exists: → Use mapped NPHIES code

IF mapping NOT exists: → Use Unlisted code based on type

------------------------------------------------------------------------

## 4. Unlisted Code Selection

function selectUnlistedCode(type, description) {

const codes = getUnlistedCodesByType(type);

const match = findClosestMatch(description, codes);

if (match) return match;

return codes.default; }

------------------------------------------------------------------------

## 5. Full Scenario (IMPORTANT)

### Scenario: Manual Code Entry

Input: - Type: Laboratory - Code: 123123 - Description: "Blood test"

Process: 1. Mapping lookup → NOT FOUND 2. System selects: → 73050-39-70
(Unlisted chemistry tests) 3. Build Shadow Billing

Output JSON:

{ "productOrService": { "coding": \[ { "system": "http://nphies.sa/...",
"code": "73050-39-70" }, { "system": "http://provider-system", "code":
"123123" } \] } }

Result: - Shadow Billing = YES - Unlisted = YES

------------------------------------------------------------------------

## 6. Scenario with Mapping

Input: - Code: 30571-00-00

Process: 1. Mapping found 2. Use mapped code 3. Add internal code as
shadow

Result: - Shadow = YES - Unlisted = NO

------------------------------------------------------------------------

## 7. Unlisted Codes by Type

Procedures → 99999-99-99\
Dental → 99999-99-91\
Imaging → 99999-99-92

Laboratory examples: - 73050-39-70 → Chemistry - 73150-01-20 →
Urinalysis

Pharmacy: - Use GTIN unlisted fallback

------------------------------------------------------------------------

## 8. Rules (CRITICAL)

-   User NEVER selects unlisted code
-   Backend ALWAYS decides unlisted
-   Mapping MUST be checked first
-   Shadow billing ALWAYS included when internal code exists

------------------------------------------------------------------------

## 9. Applies To

This logic applies to:

  Type            Applies
  --------------- ---------
  Pharmacy        YES
  Professional    YES
  Institutional   YES
  Dental          YES
  Vision          YES

------------------------------------------------------------------------

## 10. Common Mistakes

❌ Letting user choose unlisted\
❌ Random unlisted assignment\
❌ Skipping mapping step\
❌ Sending only internal code

------------------------------------------------------------------------

## 11. Summary

-   Shadow Billing = dual coding
-   Unlisted = fallback
-   Backend controls all decisions
-   Works for ALL claim and PA types

------------------------------------------------------------------------

## END
