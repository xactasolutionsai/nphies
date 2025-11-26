# NPHIES Eligibility Examples Reference

This document contains **only examples from the official NPHIES documentation**.

**Source:** [Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.json](https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.json.html)

---

## Form Fields Guide (from NPHIES Example)

### Patient Fields

| Form Field | Value to Enter | FHIR Path |
|------------|----------------|-----------|
| Full Name | `Ahmad Khaled Abbas` | Patient.name.text |
| Identifier | `G12345678` | Patient.identifier.value |
| Identifier Type | `passport` | Patient.identifier.type.coding.code = PPN |
| Gender | `male` | Patient.gender |
| Birth Date | `1984-12-25` | Patient.birthDate |
| Phone | `+966512345691` | Patient.telecom.value |
| Address | `Salamah Street, Building 25, Suite 2, Al Malga District, Riyadh, Saudi Arabia` | Patient.address.text |
| Marital Status | `M` (Married) | Patient.maritalStatus |
| Occupation | `business` | Patient.extension (occupation) |

### Coverage Fields

| Form Field | Value to Enter | FHIR Path |
|------------|----------------|-----------|
| Member ID | `0000000001` | Coverage.identifier.value |
| Coverage Type | `EHCPOL` | Coverage.type.coding.code |
| Plan Value | `CB135` | Coverage.class.value |
| Plan Name | `Insurance Plan A` | Coverage.class.name |
| Network | `Golden C` | Coverage.network |
| Dependent | `01` | Coverage.dependent |
| Relationship | `self` | Coverage.relationship.coding.code |

### Provider Fields

| Form Field | Value to Enter | FHIR Path |
|------------|----------------|-----------|
| Provider Name | `Saudi General Hospital` | Organization.name |
| Provider NPHIES ID | `PR-FHIR` | Organization.identifier.value |
| Provider Type | `Hospital` (code: 1) | Organization.extension (provider-type) |
| Location License | `GACH` | Location.identifier.value |

### Insurer Fields

| Form Field | Value to Enter | FHIR Path |
|------------|----------------|-----------|
| Insurer Name | `Saudi National Insurance` | Organization.name |
| Insurer NPHIES ID | `INS-FHIR` | Organization.identifier.value |

### Policy Holder Organization

| Form Field | Value to Enter | FHIR Path |
|------------|----------------|-----------|
| Name | `Policy Holder Organization` | Organization.name |
| Identifier | `5009` | Organization.identifier.value |

### Request Options

| Form Field | Value to Enter | FHIR Path |
|------------|----------------|-----------|
| Purpose | `validation`, `benefits` | CoverageEligibilityRequest.purpose |
| Service Date Start | `2023-07-15` | CoverageEligibilityRequest.servicedPeriod.start |
| Service Date End | `2023-07-16` | CoverageEligibilityRequest.servicedPeriod.end |
| Request ID | `req_161959` | CoverageEligibilityRequest.identifier.value |

---

## Quick Fill Summary

```
PATIENT:
  - Name: Ahmad Khaled Abbas
  - Identifier: G12345678
  - Identifier Type: passport (PPN)
  - Gender: male
  - Birth Date: 1984-12-25
  - Phone: +966512345691
  - Occupation: business

COVERAGE:
  - Member ID: 0000000001
  - Coverage Type: EHCPOL (extended healthcare)
  - Plan Value: CB135
  - Plan Name: Insurance Plan A
  - Network: Golden C
  - Dependent: 01
  - Relationship: self

PROVIDER:
  - Name: Saudi General Hospital
  - NPHIES ID: PR-FHIR
  - Provider Type: Hospital
  - Location License: GACH

INSURER:
  - Name: Saudi National Insurance
  - NPHIES ID: INS-FHIR

POLICY HOLDER:
  - Name: Policy Holder Organization
  - Identifier: 5009

REQUEST:
  - Purpose: validation ✓, benefits ✓
  - Service Date: 2023-07-15 to 2023-07-16
```

---

## Complete Request Bundle JSON

**Source:** [Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.json](https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.json.html)

```json
{
  "resourceType": "Bundle",
  "id": "4350490e-98f0-4c23-9e7d-4cd2c7011959",
  "meta": {
    "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"]
  },
  "type": "message",
  "timestamp": "2023-07-15T14:56:49.034+03:00",
  "entry": [
    {
      "fullUrl": "urn:uuid:c19c71dc-cfad-4401-b5b0-c0f20e8f1959",
      "resource": {
        "resourceType": "MessageHeader",
        "id": "c19c71dc-cfad-4401-b5b0-c0f20e8f1959",
        "meta": {
          "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"]
        },
        "eventCoding": {
          "system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events",
          "code": "eligibility-request"
        },
        "destination": [{
          "endpoint": "http://nphies.sa/license/payer-license/INS-FHIR",
          "receiver": {
            "type": "Organization",
            "identifier": {
              "system": "http://nphies.sa/license/payer-license",
              "value": "INS-FHIR"
            }
          }
        }],
        "sender": {
          "type": "Organization",
          "identifier": {
            "system": "http://nphies.sa/license/provider-license",
            "value": "PR-FHIR"
          }
        },
        "source": {
          "endpoint": "http://saudigeneralhospital.com.sa"
        },
        "focus": [{
          "reference": "http://saudigeneralhospital.com.sa/CoverageEligibilityRequest/19596"
        }]
      }
    },
    {
      "fullUrl": "http://saudigeneralhospital.com.sa/CoverageEligibilityRequest/19596",
      "resource": {
        "resourceType": "CoverageEligibilityRequest",
        "id": "19596",
        "meta": {
          "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/eligibility-request|1.0.0"]
        },
        "identifier": [{
          "system": "http://saudigeneralhospital.com.sa/identifiers/coverageeligibilityrequest",
          "value": "req_161959"
        }],
        "status": "active",
        "priority": {
          "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/processpriority",
            "code": "normal"
          }]
        },
        "purpose": ["validation", "benefits"],
        "patient": { "reference": "Patient/123454186" },
        "servicedPeriod": {
          "start": "2023-07-15",
          "end": "2023-07-16"
        },
        "created": "2023-07-15",
        "provider": { "reference": "Organization/b1b3432921324f97af3be9fd0b1a14ae" },
        "insurer": { "reference": "Organization/bff3aa1fbd3648619ac082357bf135db" },
        "facility": { "reference": "Location/2be1133308ed422a9923931c5a475f63" },
        "insurance": [{
          "coverage": { "reference": "Coverage/1333" }
        }]
      }
    },
    {
      "fullUrl": "http://saudigeneralhospital.com.sa/Coverage/1333",
      "resource": {
        "resourceType": "Coverage",
        "id": "1333",
        "meta": {
          "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0"]
        },
        "identifier": [{
          "system": "http://sni.com.sa/identifiers/memberid",
          "value": "0000000001"
        }],
        "status": "active",
        "type": {
          "coding": [{
            "system": "http://nphies.sa/terminology/CodeSystem/coverage-type",
            "code": "EHCPOL",
            "display": "extended healthcare"
          }]
        },
        "policyHolder": { "reference": "Organization/13" },
        "subscriber": { "reference": "Patient/123454186" },
        "beneficiary": { "reference": "Patient/123454186" },
        "dependent": "01",
        "relationship": {
          "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/subscriber-relationship",
            "code": "self",
            "display": "Self"
          }]
        },
        "payor": [{ "reference": "Organization/bff3aa1fbd3648619ac082357bf135db" }],
        "class": [{
          "type": {
            "coding": [{
              "system": "http://terminology.hl7.org/CodeSystem/coverage-class",
              "code": "plan"
            }]
          },
          "value": "CB135",
          "name": "Insurance Plan A"
        }],
        "network": "Golden C"
      }
    },
    {
      "fullUrl": "http://saudigeneralhospital.com.sa/Organization/13",
      "resource": {
        "resourceType": "Organization",
        "id": "13",
        "meta": {
          "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/policyholder-organization|1.0.0"]
        },
        "identifier": [{
          "system": "http://nphies.sa/identifiers/organization",
          "value": "5009"
        }],
        "active": true,
        "name": "Policy Holder Organization"
      }
    },
    {
      "fullUrl": "http://saudigeneralhospital.com.sa/Organization/b1b3432921324f97af3be9fd0b1a14ae",
      "resource": {
        "resourceType": "Organization",
        "id": "b1b3432921324f97af3be9fd0b1a14ae",
        "meta": {
          "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-organization|1.0.0"]
        },
        "extension": [{
          "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-provider-type",
          "valueCodeableConcept": {
            "coding": [{
              "system": "http://nphies.sa/terminology/CodeSystem/provider-type",
              "code": "1",
              "display": "Hospital"
            }]
          }
        }],
        "identifier": [{
          "system": "http://nphies.sa/license/provider-license",
          "value": "PR-FHIR"
        }],
        "active": true,
        "type": [{
          "coding": [{
            "system": "http://nphies.sa/terminology/CodeSystem/organization-type",
            "code": "prov"
          }]
        }],
        "name": "Saudi General Hospital",
        "address": [{
          "use": "work",
          "text": "Salamah Street, Building 25, Suite 2, Riyadh Saudi Arabia",
          "line": ["Salamah Street, Building 25, Suite 2", "Al Malga District"],
          "city": "Riyadh",
          "country": "Saudi Arabia"
        }]
      }
    },
    {
      "fullUrl": "http://saudigeneralhospital.com.sa/Patient/123454186",
      "resource": {
        "resourceType": "Patient",
        "id": "123454186",
        "meta": {
          "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0"]
        },
        "extension": [{
          "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-occupation",
          "valueCodeableConcept": {
            "coding": [{
              "system": "http://nphies.sa/terminology/CodeSystem/occupation",
              "code": "business"
            }]
          }
        }],
        "identifier": [{
          "extension": [{
            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-identifier-country",
            "valueCodeableConcept": {
              "coding": [{
                "system": "urn:iso:std:iso:3166",
                "code": "SAU",
                "display": "Saudi Arabia"
              }]
            }
          }],
          "type": {
            "coding": [{
              "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
              "code": "PPN",
              "display": "Passport Number"
            }]
          },
          "system": "http://nphies.sa/identifier/passportnumber",
          "value": "G12345678"
        }],
        "active": true,
        "name": [{
          "use": "official",
          "text": "Ahmad Khaled Abbas",
          "family": "Ahmad",
          "given": ["Khaled", "Abbas"]
        }],
        "telecom": [{
          "system": "phone",
          "value": "+966512345691"
        }],
        "gender": "male",
        "_gender": {
          "extension": [{
            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-administrative-gender",
            "valueCodeableConcept": {
              "coding": [{
                "system": "http://nphies.sa/terminology/CodeSystem/ksa-administrative-gender",
                "code": "male"
              }]
            }
          }]
        },
        "birthDate": "1984-12-25",
        "deceasedBoolean": false,
        "address": [{
          "use": "home",
          "text": "Salamah Street, Building 25, Suite 2, Saudi Arabia",
          "line": ["Salamah Street, Building 25, Suite 2", "Al Malga District"],
          "city": "Riyadh",
          "country": "Saudi Arabia"
        }],
        "maritalStatus": {
          "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus",
            "code": "M"
          }]
        }
      }
    },
    {
      "fullUrl": "http://saudigeneralhospital.com.sa/Organization/bff3aa1fbd3648619ac082357bf135db",
      "resource": {
        "resourceType": "Organization",
        "id": "bff3aa1fbd3648619ac082357bf135db",
        "meta": {
          "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-organization|1.0.0"]
        },
        "identifier": [{
          "use": "official",
          "type": {
            "coding": [{
              "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
              "code": "NII"
            }]
          },
          "system": "http://nphies.sa/license/payer-license",
          "value": "INS-FHIR"
        }],
        "active": true,
        "type": [{
          "coding": [{
            "system": "http://nphies.sa/terminology/CodeSystem/organization-type",
            "code": "ins"
          }]
        }],
        "name": "Saudi National Insurance",
        "address": [{
          "use": "work",
          "text": "Olaya Street, Building 70, Riyadh Saudi Arabia",
          "line": ["Olaya Street, Building 70", "Al Olaya District"],
          "city": "Riyadh",
          "country": "Saudi Arabia"
        }]
      }
    },
    {
      "fullUrl": "http://saudigeneralhospital.com.sa/Location/2be1133308ed422a9923931c5a475f63",
      "resource": {
        "resourceType": "Location",
        "id": "2be1133308ed422a9923931c5a475f63",
        "meta": {
          "profile": ["http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/location|1.0.0"]
        },
        "identifier": [{
          "system": "http://nphies.sa/license/location-license",
          "value": "GACH"
        }],
        "status": "active",
        "name": "Saudi General Hospital",
        "type": [{
          "coding": [{
            "system": "http://terminology.hl7.org/CodeSystem/v3-RoleCode",
            "code": "GACH"
          }]
        }],
        "managingOrganization": {
          "reference": "Organization/b1b3432921324f97af3be9fd0b1a14ae"
        }
      }
    }
  ]
}
```

---

## NPHIES Documentation Links

- **Bundle Profile**: https://portal.nphies.sa/ig/StructureDefinition-bundle.html
- **Eligibility Use Case**: https://portal.nphies.sa/ig/usecase-eligibility.html
- **Request Bundle Example**: https://portal.nphies.sa/ig/Bundle-4350490e-98f0-4c23-9e7d-4cd2c7011959.json.html
- **Response Bundle Example**: https://portal.nphies.sa/ig/Bundle-43c68545-8e37-4744-b8ea-9a1e3c1ada84.html
- **Patient Profile**: https://portal.nphies.sa/ig/StructureDefinition-patient.html
- **Coverage Profile**: https://portal.nphies.sa/ig/StructureDefinition-coverage.html
- **CoverageEligibilityRequest Profile**: https://portal.nphies.sa/ig/StructureDefinition-eligibility-request.html
