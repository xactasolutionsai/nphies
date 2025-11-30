
# NPHIES Prior Authorization – Complete Technical Documentation (English)

## 0. Source and Scope
Source: NPHIES Healthcare Financial Services IG — Use Case: Prior-Authorization.
Scope: Prior Authorization only — Institutional, Professional, Pharmacy, Dental, Vision.

## 1. Overview
Prior Authorization (PA) enables healthcare providers to obtain approval from a Health Insurance Company (HIC) before delivering services.

## 2. Actors
- Provider (HCP)
- NPHIES Gateway
- Payer (Insurer/TPA)

## 3. Key Behaviors & Timeouts
- Real-time and non-real-time transactions
- Pended responses include `bundle.meta.tag` = `nphies-generated`
- Providers must poll for delayed responses

## 4. Message Envelope Requirements
- Bundle.type = message
- First entry: MessageHeader
- eventCoding.code: priorauth-request / priorauth-response

## 5. Authorization Profiles
The following NPHIES Authorization profiles must be used in PA requests:
- Nphies Authorization Institutional
- Nphies Authorization Oral
- Nphies Authorization Pharmacy
- Nphies Authorization Professional
- Nphies Authorization Vision

## 6. Bundle Content — Prior Authorization Request
- MessageHeader (eventCoding = priorauth-request)
- NPHIES Authorization profile resource
- Coverage, Patient, Organization, Practitioner, Encounter
- SupportingInfo / Binary resources as needed

## 7. Bundle Content — Prior Authorization Response
- MessageHeader (eventCoding = priorauth-response)
- Nphies Authorization Response resource
- Coverage, Patient, Organization, optional Notes, CommunicationRequest
- Must include adjudication outcome and preAuthRef

## 8. Common Extensions & Important Elements
- ClaimResponse.preAuthRef
- Eligibility Response / offline extensions
- supportingInfo.days-supply for pharmacy
- servicedDate for completed items
- Cancel-request via Task.focus
- Transfer extensions for referral

## 9. Change Management: Modify / Cancel / Transfer
- Initial Authorization: dynamic authorization file, returns preAuthRef
- Update Authorization: include previous preAuthRef, preserve item.sequence
- Cancel Authorization: Task.focus referencing preAuthRef
- Transfer (Referral): use transfer extensions and offline authorization

## 10. Queueing, Pended Messages & nphies-generated meta tag
- Payer responses may be queued or delayed
- NPHIES pended messages include bundle.meta.tag = nphies-generated
- Providers must implement polling to retrieve final responses

## 11. Examples (Request / Response / Update / OperationOutcome)
### Prior Authorization Request (minimal skeleton)
```json
{
  "resourceType": "Bundle",
  "type": "message",
  "entry": [
    { "resource": { "resourceType": "MessageHeader", "eventCoding": { "code": "priorauth-request", "system": "http://nphies.sa/terminology" } } },
    { "resource": { "resourceType": "Claim", "id": "pa-001", "status": "active", "type": { "coding": [{ "code": "preauthorization" }] }, "patient": { "reference": "Patient/123" }, "provider": { "reference": "Organization/456" }, "insurance": [{ "coverage": { "reference": "Coverage/789" } }], "item": [{ "sequence": 1, "productOrService": { "coding": [{ "system": "http://snomed.info/sct", "code": "123456" }] }, "unitPrice": { "value": 1500, "currency": "SAR" } }] } }
  ]
}
```
### Prior Authorization Response (includes preAuthRef)
```json
{
  "resourceType": "Bundle",
  "type": "message",
  "entry": [
    { "resource": { "resourceType": "MessageHeader", "eventCoding": { "code": "priorauth-response" } } },
    { "resource": { "resourceType": "ClaimResponse", "id": "resp-001", "status": "active", "outcome": "complete", "disposition": "Approved", "preAuthRef": "AUTH-998877", "item": [{ "itemSequence": 1, "adjudication": [{ "category": { "coding": [{ "code": "eligible" }] }, "amount": { "value": 1500, "currency": "SAR" } }] }] } }
  ]
}
```

## 12. Validation Rules & Implementation
### 12.1 Overview
Validation ensures all PA resources comply with FHIR R4 and NPHIES-specific profiles.

### 12.2 Types of Validation
1. FHIR Structural Validation
2. Profile Validation
3. Business Rule Validation
4. Cross-Resource Validation

### 12.3 Key Validation Rules
#### 12.3.1 Patient Rules
- Valid national ID
- Active status
- DOB not in future
- Gender per NPHIES value sets

#### 12.3.2 Coverage Rules
- Coverage with payer, subscriber ID, class type, policy validity
- Request date within coverage period
- Plan supports requested service

#### 12.3.3 Service Request Rules
- Procedure codes in UMD / NPHIES codes
- Services requiring PA must be included in PA list
- Valid active CPT/SNOMED/ICD codes

#### 12.3.4 Provider Rules
- Provider must be registered in NPHIES
- Practitioner active and licensed
- Facility type appropriate for service

### 12.4 Validation Workflow
1. Receive PA Bundle
2. Structural FHIR validation
3. Profile validation
4. Business rule checks
5. Return validation outcome

Errors: OperationOutcome with severity error; warnings optional

### 12.5 Error Handling
- Use OperationOutcome: severity, code, details, expression

### 12.6 Implementation Guidance
- Validate against NPHIES IG
- Servers must support $validate
- Track code/value set versions
- Use automated regression testing

## 13. Implementation Scenarios
13.1 Outpatient Authorization
13.2 Inpatient Admission
13.3 Pharmacy Authorization

## 14. Integration & Testing
14.1 Sandbox Environment
14.2 Test Cases

## 15. Deployment Considerations
15.1 Security Requirements
15.2 Logging & Monitoring
15.3 Performance

## 16. Appendices
Value Sets, Code Systems, Business Rules Tables, Sample Bundles
