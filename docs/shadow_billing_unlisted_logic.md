# Shadow Billing & Unlisted Codes -- Implementation Guide (NPHIES)

## Overview

This document explains how to correctly implement: - Shadow Billing
(dual coding) - Unlisted Code handling - Backend decision logic - UI +
Backend responsibilities

------------------------------------------------------------------------

## 1. Key Concepts

### Shadow Billing

Send both: - NPHIES code - Internal code

### Unlisted Codes

Used ONLY when no mapping exists.

------------------------------------------------------------------------

## 2. Critical Rule

Unlisted code is NEVER chosen by the user. It is decided by backend.

------------------------------------------------------------------------

## 3. Flow

User input → Mapping → Decision → Build JSON

------------------------------------------------------------------------

## 4. Decision Logic

If mapping exists: - Use mapped code

If mapping missing: - Use correct unlisted code based on type

------------------------------------------------------------------------

## 5. Example Logic

function processCode(inputCode, type, description) { const mapping =
findMapping(inputCode);

if (mapping) { return buildCoding(mapping.code, inputCode); }

const unlistedCode = selectUnlistedCode(type, description); return
buildCoding(unlistedCode, inputCode); }

------------------------------------------------------------------------

## 6. Unlisted Codes by Type

Procedures → 99999-99-99\
Dental → 99999-99-91\
Imaging → 99999-99-92\
Laboratory → category-based\
Pharmacy → GTIN fallback

------------------------------------------------------------------------

## 7. Frontend Rules

DO: - Allow manual entry - Provide type selection

DO NOT: - Let user choose unlisted - Let user decide shadow billing

------------------------------------------------------------------------

## 8. Backend Rules

-   Detect mapping
-   Assign unlisted if needed
-   Always send dual coding

------------------------------------------------------------------------

## 9. Summary

Shadow = dual coding\
Unlisted = fallback\
Backend controls everything
