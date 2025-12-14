# Payment Reconciliation Module – nphies (FHIR R4)

## Objective
Build a **Payment Reconciliation module** fully compliant with the **Saudi nphies FHIR R4 Implementation Guide**.

This module represents the **post-claim payment notification and reconciliation phase** between Insurer (HIC) and Provider.

---

## Business Context
- The module is triggered **only after a Claim has been adjudicated**.
- It is **NOT related to Prior Authorization**.
- It does **NOT create, submit, or adjudicate Claims**.
- It handles **payment notification and reconciliation only**.

---

## Scope

### In Scope
- Receiving Payment Reconciliation messages from Insurers
- Parsing and validating FHIR Bundles
- Handling nphies-specific FHIR Extensions
- Linking payments to Claims and ClaimResponses
- Returning technical acknowledgements

### Out of Scope
- Prior Authorization
- Claim submission or adjudication
- Actual payment execution (bank transfer)
- Accounting or financial ledger logic

---

## Input Requirements

### FHIR Message
- Accept a **FHIR Bundle (JSON)** of type `collection`
- Bundle MUST contain a `PaymentReconciliation` resource
- The PaymentReconciliation resource MUST be processed only when wrapped inside a Bundle

---

## Mandatory Fields Validation

Validate mandatory core fields according to nphies IG (excluding optional extensions):

- `PaymentReconciliation.id`
- `PaymentReconciliation.status`
- `PaymentReconciliation.created`
- `PaymentReconciliation.paymentDate`
- `PaymentReconciliation.paymentAmount`
- `PaymentReconciliation.detail`
  - `detail.request` → reference to Claim
  - `detail.response` → reference to ClaimResponse
  - `detail.amount`

Reject the message if any mandatory core field is missing or invalid.

---

## Key nphies Extensions (Mandatory Support)

The implementation MUST explicitly support the following **nphies Payment Reconciliation extensions**:

### 1. Component Payment
- Represents the **actual payment amount**
- MUST be captured and stored
- MUST be reconcilable with `paymentAmount`

### 2. Component Early Fee
- Represents the **charge applied for early settlement**
- MUST be parsed and stored separately
- MUST NOT be treated as part of the paid amount

### 3. Component nphies Fee
- Represents the **nphies service charge**
- MUST be parsed and stored separately
- MUST NOT be treated as part of the paid amount

### Extension Handling Rules
- Extensions may appear at:
  - Resource level
  - Element level (e.g. paymentAmount, detail)
- The system MUST:
  - Accept both known and unknown extensions
  - Never reject a message due to unrecognized extensions
  - Persist extensions as structured JSON
- Validation is required **only** for extensions explicitly defined as mandatory by nphies

### Extension Identification Rule
- Extensions MUST be identified and processed using their canonical `extension.url`
- Do NOT rely on extension display names or order
- Supported URLs include:
  - extension-component-payment
  - extension-component-early-fee
  - extension-component-nphies-fee


---

## Payment Handling Rules
- One Payment Reconciliation may include **multiple claims**
- Support:
  - Full payments
  - Partial payments
  - Adjusted payments
- Each payment detail MUST be linked to:
  - Claim ID
  - ClaimResponse ID
  - Paid amount
  - Related payment components (fees, deductions)

---

## Workflow

1. Insurer sends PaymentReconciliation Bundle
2. System validates:
   - FHIR R4 structure
   - Mandatory core fields
   - Presence of required nphies extensions
   - Claim and ClaimResponse references
3. Persist reconciliation and component data
4. Link payments to existing claims
5. Return a **FHIR Acknowledgement Bundle** confirming receipt

---

## API Design

### Endpoint

### Request
- FHIR Bundle (collection)
- Content-Type: `application/fhir+json`

### Response
- FHIR Acknowledgement Bundle
- HTTP Status:
  - `200` Accepted
  - `400` Validation error
  - `409` Duplicate reconciliation

---

## Data Model (Logical)

### PaymentReconciliation
- id
- status
- createdDate
- paymentDate
- totalPaymentAmount

### PaymentComponent
- componentType (Payment | EarlyFee | nphiesFee)
- amount

### PaymentDetail
- claimId
- claimResponseId
- paidAmount
- components[]

Payment reconciliation data MUST be stored separately from Claims.

---

## Technical Requirements
- FHIR R4 compliant
- JSON only
- Stateless REST API
- Idempotent processing
- Forward-compatible with future nphies extensions
- Clear error handling and logging

---

## References (nphies)
- Payment Reconciliation Use Case
- PaymentReconciliation resource example
- PaymentReconciliation Bundle example
- Acknowledgement Bundle example

---

## Deliverables
- Data models
- API contract
- Validation rules
- End-to-end workflow
- Sample request and response JSON
- Sequence diagram

## References
https://portal.nphies.sa/ig/usecase-payment-reconciliation.html
https://portal.nphies.sa/ig/PaymentReconciliation-90581.json.html
https://portal.nphies.sa/ig/Bundle-c2c63768-a65b-4784-ab91-6c09012c3aee.json.html
https://portal.nphies.sa/ig/Bundle-96b80922-b538-4ab3-0176-a80b51242161.json.html
https://portal.nphies.sa/ig/StructureDefinition-extension-component-early-fee.html
https://portal.nphies.sa/ig/StructureDefinition-extension-component-early-fee.profile.json.html
https://portal.nphies.sa/ig/StructureDefinition-extension-component-nphies-fee.html
https://portal.nphies.sa/ig/StructureDefinition-extension-component-nphies-fee.profile.json.html
https://portal.nphies.sa/ig/StructureDefinition-extension-component-payment.html
https://portal.nphies.sa/ig/StructureDefinition-extension-component-payment.profile.json.html