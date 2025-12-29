# Batch Claim – NPHIES Structure Guide (Final)

## Definition

**Batch Claim in NPHIES is a SUBMISSION GROUPING mechanism only, NOT a batch processing mechanism.**

Each Claim is sent in a **separate Bundle** - they are grouped **logically** through batch extensions inside each Claim.

---

## Core Rules

| Rule | Description |
|------|-------------|
| Separate Bundles | Each Claim MUST be submitted in its own Bundle |
| Single Focus | MessageHeader.focus MUST contain exactly ONE Claim reference |
| Event Code | MessageHeader.eventCoding.code MUST be `claim-request` |
| Logical Grouping | Claims are grouped by batch extensions only |

---

## Correct Structure (Per Claim)

```
Bundle (type = message)
├── MessageHeader
│   ├── eventCoding = claim-request
│   └── focus → [ONE Claim only]
├── Claim (with batch extensions)
│   ├── extension-batch-identifier = "BATCH-123"
│   ├── extension-batch-number = 1
│   └── extension-batch-period
├── Patient
├── Coverage
├── Provider Organization
├── Insurer Organization
└── Practitioner(s)
```

---

## Batch Submission Flow

```
Batch of 3 Claims:

┌─────────────────────────────────────────────────────────────┐
│ Batch Identifier: BATCH-123                                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Bundle 1 ──────────► NPHIES ──────────► ClaimResponse 1    │
│  (Claim 1, batch-number: 1)                                  │
│                                                              │
│  Bundle 2 ──────────► NPHIES ──────────► ClaimResponse 2    │
│  (Claim 2, batch-number: 2)                                  │
│                                                              │
│  Bundle 3 ──────────► NPHIES ──────────► ClaimResponse 3    │
│  (Claim 3, batch-number: 3)                                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘

All Claims share the same batch-identifier but are sent separately.
```

---

## Required Batch Extensions (Per Claim)

Each Claim in the batch MUST include these extensions:

### 1. extension-batch-identifier
```json
{
  "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier",
  "valueIdentifier": {
    "system": "http://provider.com/batch",
    "value": "BATCH-20251229-123456"
  }
}
```
**Same value for ALL Claims in the batch**

### 2. extension-batch-number
```json
{
  "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number",
  "valuePositiveInt": 1
}
```
**Unique sequence number per Claim (1, 2, 3, ...)**

### 3. extension-batch-period
```json
{
  "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period",
  "valuePeriod": {
    "start": "2025-12-29",
    "end": "2025-12-29"
  }
}
```
**Same period for all Claims in the batch**

---

## Forbidden Patterns (Cause Errors)

| Pattern | Error Code | Description |
|---------|------------|-------------|
| Multiple Claims in single MessageHeader | BV-00221 | "Message Header Focus contains more than one main resource" |
| Using `batch-request` for Claims | BV-00167 | "The MessageHeader focus resource type does not match the MessageHeader eventCoding" |
| `claim-request` with multiple focus | BV-00221 | Focus must reference exactly ONE Claim |

---

## Event Codes Reference

| Event Code | Focus Must Point To | Use Case |
|------------|---------------------|----------|
| `claim-request` | ONE Claim | Single Claim or Batch Claim (one per bundle) |
| `batch-request` | Bundle(s) | Different use case (not for Claims) |
| `claim-response` | ONE ClaimResponse | Response from NPHIES |

---

## Batch Constraints

All Claims in a batch MUST:
- Be Approved Prior Authorizations
- Be from the same Provider
- Be from the same Payer (Insurer)
- Be of the same Claim Type (oral, vision, professional, etc.)
- Have batch size between 2 and 200 claims

---

## Implementation Notes

### Building Batch Bundles
```javascript
// Use buildBatchClaimBundles (returns array of bundles)
const bundles = batchClaimMapper.buildBatchClaimBundles(data);

// Each bundle is sent separately
for (const bundle of bundles) {
  await nphiesService.submitClaim(bundle);
}
```

### DO NOT USE (Deprecated)
```javascript
// This causes BV-00221 error!
const singleBundle = batchClaimMapper.buildBatchClaimRequestBundle(data);
```

---

## Response Handling

Each Bundle submission returns its own ClaimResponse:
- Aggregate all responses for batch status
- Track individual claim outcomes
- Handle partial success (some claims succeed, some fail)

### Batch Status Logic
| Condition | Status |
|-----------|--------|
| All claims failed | Error |
| Some claims failed | Partial |
| All claims queued | Queued |
| All claims succeeded | Submitted |

---

## References

- [NPHIES ValueSet - ksa-message-events](https://portal.nphies.sa/ig/ValueSet-ksa-message-events.html)
- [NPHIES Batch Claim Use Case](https://portal.nphies.sa/ig/usecase-claim-batch.html)
