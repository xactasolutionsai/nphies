
# NPHIES Prior Authorization – Complete Use Case Documentation

## Overview
This use case enables healthcare providers (HCPs) to obtain approval from the Health Insurance Company (HIC) before delivering healthcare services to beneficiaries. The Prior Authorization (PA) process ensures that requested services or treatments meet payer criteria for coverage and reimbursement. Providers submit an authorization request to NPHIES, which validates and routes the request to the respective insurer or Third-Party Administrator (TPA).

## Workflow
1. Provider sends a Prior Authorization Request Message to the NPHIES system.
2. NPHIES validates the request; if invalid, an error response is generated.
3. NPHIES forwards the request to the designated insurer or TPA.
4. Insurer/TPA adjudicates and returns a Prior Authorization Response Message.
5. NPHIES validates the response; if invalid, an error notice is generated.
6. NPHIES returns the Prior Authorization Response Message with approval, denial, or additional information requests to the provider.

### Transaction Types
- Real-Time Transactions: Automatic adjudication with immediate response.
- Non-Real-Time Transactions: Manual review, queued responses, partial and final adjudications.
- Pended Requests: Stored on NPHIES for later delivery if exchange fails.

## Message Structures

### Prior Authorization Request Message
- Bundle.type = message
- First entry: MessageHeader (eventCoding = priorauth-request)
- Authorization profile resource (one of):
  - Nphies Authorization Institutional
  - Nphies Authorization Oral
  - Nphies Authorization Pharmacy
  - Nphies Authorization Professional
  - Nphies Authorization Vision
- Coverage, Patient, Provider Organization, Insurer Organization, Practitioner
- Encounter (profile varies based on authorization type)
- SupportingInfo / Binary resources as needed

### Prior Authorization Response Message
- Bundle.type = message
- First entry: MessageHeader (eventCoding = priorauth-response)
- Authorization Response resource (corresponding profile)
- Coverage, Patient, Provider Organization, Insurer Organization
- Policy Holder Organization, CommunicationRequest
- SupportingInfo / Binary resources as needed

## Guidance
Each type of prior authorization follows a similar request-response pattern but may have specific extensions or required data elements.

### Authorization Types
1. **Institutional Authorization** – Hospital-based services, inpatient admissions, surgical procedures.
2. **Professional Authorization** – Outpatient physician services, consultations, diagnostics.
3. **Pharmacy Authorization** – Prescription medications requiring approval before dispensing.
4. **Dental Authorization** – Major dental procedures, e.g., orthodontics or surgeries.
5. **Vision Authorization** – Optical services including corrective lenses and eye surgeries.

## Validation Rules
- Structural: FHIR R4 compliance
- Profile: NPHIES-specific profiles validation
- Business Rules: Coverage eligibility, provider verification, service code validation
- Cross-Resource Checks: patient-coverage, item sequencing
- Error Handling: OperationOutcome with severity, code, and details

## Full Examples

### Prior Authorization Request Example (JSON)
```json
{
  "resourceType": "Bundle",
  "type": "message",
  "entry": [
    {
      "resource": {
        "resourceType": "MessageHeader",
        "eventCoding": { "code": "priorauth-request" }
      }
    },
    {
      "resource": {
        "resourceType": "Claim",
        "status": "active",
        "type": { "coding": [{ "code": "preauthorization" }] },
        "patient": { "reference": "Patient/123" },
        "provider": { "reference": "Organization/456" },
        "insurance": [{ "coverage": { "reference": "Coverage/789" } }],
        "item": [{ "sequence": 1, "productOrService": { "coding": [{ "code": "99213" }] }, "unitPrice": { "value": 250, "currency": "SAR" } }]
      }
    }
  ]
}
```

### Prior Authorization Response Example (JSON)
```json
{
  "resourceType": "Bundle",
  "type": "message",
  "entry": [
    {
      "resource": {
        "resourceType": "MessageHeader",
        "eventCoding": { "code": "priorauth-response" }
      }
    },
    {
      "resource": {
        "resourceType": "ClaimResponse",
        "status": "active",
        "outcome": "complete",
        "preAuthRef": "AUTH-55221",
        "item": [{ "itemSequence": 1, "adjudication": [{ "category": { "coding": [{ "code": "approved" }] } }] }]
      }
    }
  ]
}
```

## Key Extensions
- SupportingInfo and Binary for attachments
- Eligibility Response extensions if eligibility check performed
- Meta tag: nphies-generated for queued/pended responses

## Error Handling
- OperationOutcome must include severity, code, and details for errors
- Warnings optional, returned in OperationOutcome
