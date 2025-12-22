# NPHIES Poll-Request / Poll-Response – Validation Fixes

## Overview
This document describes the minimal and safe changes required to make the poll-request / poll-response flow compliant with the NPHIES Implementation Guide (IG).

IMPORTANT:
- Do NOT redesign the system
- Do NOT regenerate resources from scratch
- Apply ONLY the fixes listed here
- Existing backend logic must remain unchanged
- These fixes are validation-related only

## Scope
- Applies to all poll-request use cases
- Applies to all Prior Authorization types (pharmacy, institutional, professional, etc.)
- Provider License accepts numeric values only

## 1. MessageHeader.focus (CRITICAL)

Rule:
MessageHeader.focus[0].reference MUST exactly match the fullUrl of the Task resource within the same Bundle.

- Matching must be character-by-character
- urn:uuid references are allowed
- Absolute URLs are allowed
- Reference style does not matter as long as it matches the Task fullUrl

Example:
If Task fullUrl is:
urn:uuid:task-001

Then MessageHeader focus MUST be:
urn:uuid:task-001

Any mismatch results in:
- RE-00169
- RE-00100

## 2. Task Resource – Required Fields

The Task resource MUST conform to:
StructureDefinition/poll-request | 1.0.0

Mandatory fields:
- identifier
- status
- intent
- code
- requester
- owner
- authoredOn

If identifier is missing, add:
system: http://provider.com/fhir/identifiers/poll-request
value: existing request id

Notes:
- Do NOT invent new identifiers
- Do NOT add optional fields unless explicitly required
- priority and lastModified are OPTIONAL

## 3. Provider Organization Rules

NOT allowed in poll-request:
- extension-provider-type
- any ProviderType-related extension

If present, remove them.
These cause:
- IC-01428
- IC-01574

Allowed Provider Organization structure:
- identifier (provider-license, numeric only)
- type = prov
- name
- active

No extensions are required.

## 4. Reference Integrity

All references MUST:
- Point to a resource in the SAME Bundle
- Be internally resolvable

Allowed reference styles:
- Relative
- Absolute
- urn:uuid

Do NOT change reference styles unless broken.

## 5. What MUST NOT Be Changed

DO NOT:
- Change Bundle.type
- Change MessageHeader.eventCoding
- Convert urn:uuid references to absolute URLs just to match samples
- Add ProviderType extensions
- Add optional fields to mimic examples
- Rebuild MessageHeader or Task resources

## 6. Expected Outcome

After applying these fixes:
- No RE-00169
- No RE-00170
- No IC-01428
- No IC-01574
- Poll-request validation passes
- Task status transitions correctly

## 7. If Validation Still Fails

Report only:
- Resource name
- Field path
- Exact NPHIES error code

Do not apply speculative changes.

Status:
Approved for implementation
Safe for production
Aligned with NPHIES IG
