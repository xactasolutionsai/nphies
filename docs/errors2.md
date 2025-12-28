{
    "success": false,
    "data": {
        "id": 7,
        "batch_identifier": "BATCH-20251228-239725",
        "provider_id": "b4ea317c-fb81-4957-afa6-5c8ad0c397ac",
        "insurer_id": "69912bb9-020e-42ac-839b-adb11efc18c0",
        "status": "Error",
        "total_amount": "0.00",
        "total_claims": 2,
        "processed_claims": 0,
        "approved_claims": 0,
        "rejected_claims": 0,
        "approved_amount": "0.00",
        "batch_period_start": "2025-12-27T21:00:00.000Z",
        "batch_period_end": "2025-12-27T21:00:00.000Z",
        "nphies_request_id": null,
        "nphies_response_id": null,
        "request_bundle": {
            "id": "f1599067-d8a2-4840-b48b-bd6498a6278f",
            "meta": {
                "profile": [
                    "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"
                ]
            },
            "type": "message",
            "entry": [
                {
                    "fullUrl": "urn:uuid:e3030fd3-d3de-441a-be93-7a329a15ab5d",
                    "resource": {
                        "id": "e3030fd3-d3de-441a-be93-7a329a15ab5d",
                        "meta": {
                            "profile": [
                                "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"
                            ]
                        },
                        "focus": [
                            {
                                "reference": "urn:uuid:64c92ac8-9d1c-4eff-90e9-c1e697019c23"
                            },
                            {
                                "reference": "urn:uuid:06dfb9d4-391f-48db-ac7e-c4f21304ef86"
                            }
                        ],
                        "sender": {
                            "type": "Organization",
                            "identifier": {
                                "value": "1010613708",
                                "system": "http://nphies.sa/license/provider-license"
                            }
                        },
                        "source": {
                            "endpoint": "http://provider.com"
                        },
                        "destination": [
                            {
                                "endpoint": "http://nphies.sa/license/payer-license/destinationLicense",
                                "receiver": {
                                    "type": "Organization",
                                    "identifier": {
                                        "value": "INS-FHIR",
                                        "system": "http://nphies.sa/license/payer-license"
                                    }
                                }
                            }
                        ],
                        "eventCoding": {
                            "code": "batch-request",
                            "system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events"
                        },
                        "resourceType": "MessageHeader"
                    }
                },
                {
                    "fullUrl": "urn:uuid:97782c46-6eec-4c09-aef9-d32fc5da98f9",
                    "resource": {
                        "id": "97782c46-6eec-4c09-aef9-d32fc5da98f9",
                        "meta": {
                            "profile": [
                                "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"
                            ]
                        },
                        "type": "message",
                        "entry": [
                            {
                                "fullUrl": "urn:uuid:64c92ac8-9d1c-4eff-90e9-c1e697019c23",
                                "resource": {
                                    "id": "64c92ac8-9d1c-4eff-90e9-c1e697019c23",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"
                                        ]
                                    },
                                    "focus": [
                                        {
                                            "reference": "http://provider.com/Claim/86d90225-54ec-4e8b-9a1b-ccc897b874a1"
                                        }
                                    ],
                                    "sender": {
                                        "type": "Organization",
                                        "identifier": {
                                            "value": "1010613708",
                                            "system": "http://nphies.sa/license/provider-license"
                                        }
                                    },
                                    "source": {
                                        "endpoint": "http://provider.com"
                                    },
                                    "destination": [
                                        {
                                            "endpoint": "http://nphies.sa/license/payer-license/INS-FHIR",
                                            "receiver": {
                                                "type": "Organization",
                                                "identifier": {
                                                    "value": "INS-FHIR",
                                                    "system": "http://nphies.sa/license/payer-license"
                                                }
                                            }
                                        }
                                    ],
                                    "eventCoding": {
                                        "code": "claim-request",
                                        "system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events"
                                    },
                                    "resourceType": "MessageHeader"
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Claim/86d90225-54ec-4e8b-9a1b-ccc897b874a1",
                                "resource": {
                                    "id": "86d90225-54ec-4e8b-9a1b-ccc897b874a1",
                                    "use": "claim",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-claim|1.0.0"
                                        ]
                                    },
                                    "type": {
                                        "coding": [
                                            {
                                                "code": "professional",
                                                "system": "http://terminology.hl7.org/CodeSystem/claim-type"
                                            }
                                        ]
                                    },
                                    "payee": {
                                        "type": {
                                            "coding": [
                                                {
                                                    "code": "provider",
                                                    "system": "http://terminology.hl7.org/CodeSystem/payeetype"
                                                }
                                            ]
                                        }
                                    },
                                    "total": {
                                        "value": 0,
                                        "currency": "SAR"
                                    },
                                    "status": "active",
                                    "created": "2025-12-28T22:14:31+03:00",
                                    "insurer": {
                                        "reference": "Organization/69912bb9-020e-42ac-839b-adb11efc18c0"
                                    },
                                    "patient": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "subType": {
                                        "coding": [
                                            {
                                                "code": "op",
                                                "system": "http://nphies.sa/terminology/CodeSystem/claim-subtype"
                                            }
                                        ]
                                    },
                                    "careTeam": [
                                        {
                                            "role": {
                                                "coding": [
                                                    {
                                                        "code": "primary",
                                                        "system": "http://terminology.hl7.org/CodeSystem/claimcareteamrole"
                                                    }
                                                ]
                                            },
                                            "provider": {
                                                "reference": "Practitioner/46df4695-f059-416f-ad57-1856f50c0bd2"
                                            },
                                            "sequence": 1,
                                            "qualification": {
                                                "coding": [
                                                    {
                                                        "code": "08.00",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/practice-codes"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "priority": {
                                        "coding": [
                                            {
                                                "code": "normal",
                                                "system": "http://terminology.hl7.org/CodeSystem/processpriority"
                                            }
                                        ]
                                    },
                                    "provider": {
                                        "reference": "Organization/b4ea317c-fb81-4957-afa6-5c8ad0c397ac"
                                    },
                                    "extension": [
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter",
                                            "valueReference": {
                                                "reference": "Encounter/1e7691e2-7d6c-43bf-a7c6-73e01fe515cf"
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-authorization-offline-date",
                                            "valueDateTime": "2025-12-13T00:00:00+03:00"
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode",
                                            "valueIdentifier": {
                                                "value": "provider_EpisodeID_DUP-1766936788901-1",
                                                "system": "http://provider.com.sa/identifiers/episode"
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod",
                                            "valueDate": "2025-12-01"
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier",
                                            "valueIdentifier": {
                                                "value": "BATCH-20251228-239725",
                                                "system": "http://provider.com/batch"
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number",
                                            "valuePositiveInt": 1
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period",
                                            "valuePeriod": {
                                                "end": "2025-12-28",
                                                "start": "2025-12-28"
                                            }
                                        }
                                    ],
                                    "insurance": [
                                        {
                                            "focal": true,
                                            "coverage": {
                                                "reference": "Coverage/f18d5668-2914-4f15-b2ed-01fb686c3761"
                                            },
                                            "sequence": 1,
                                            "preAuthRef": [
                                                "8f71e966-6dc9-448d-a069-f9bdf66b0f24"
                                            ]
                                        }
                                    ],
                                    "identifier": [
                                        {
                                            "value": "DUP-1766936788901-1",
                                            "system": "http://provider.com.sa/identifiers/claim"
                                        }
                                    ],
                                    "resourceType": "Claim",
                                    "supportingInfo": [
                                        {
                                            "code": {
                                                "text": "Patient presenting for evaluation"
                                            },
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "chief-complaint",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 1
                                        },
                                        {
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "patient-history",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 2,
                                            "valueString": "No systemic disease"
                                        },
                                        {
                                            "code": {
                                                "coding": [
                                                    {
                                                        "code": "INP",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/investigation-result",
                                                        "display": "Investigation(s) not performed"
                                                    }
                                                ]
                                            },
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "investigation-result",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 3
                                        },
                                        {
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "treatment-plan",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 4,
                                            "valueString": "Analgesic Drugs"
                                        },
                                        {
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "physical-examination",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 5,
                                            "valueString": "Stable"
                                        },
                                        {
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "history-of-present-illness",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 6,
                                            "valueString": "No history"
                                        }
                                    ]
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Encounter/1e7691e2-7d6c-43bf-a7c6-73e01fe515cf",
                                "resource": {
                                    "id": "1e7691e2-7d6c-43bf-a7c6-73e01fe515cf",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0"
                                        ]
                                    },
                                    "class": {
                                        "code": "HH",
                                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                                        "display": "home health"
                                    },
                                    "period": {
                                        "start": "2025-12-13T03:00:00+03:00"
                                    },
                                    "status": "finished",
                                    "subject": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "extension": [
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-serviceEventType",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "ICSE",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/service-event-type",
                                                        "display": "Initial client service event"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "identifier": [
                                        {
                                            "value": "DUP-1766936788901-1",
                                            "system": "http://prfhir.com.sa/identifiers/encounter"
                                        }
                                    ],
                                    "resourceType": "Encounter",
                                    "serviceProvider": {
                                        "reference": "Organization/b4ea317c-fb81-4957-afa6-5c8ad0c397ac"
                                    }
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Coverage/f18d5668-2914-4f15-b2ed-01fb686c3761",
                                "resource": {
                                    "id": "f18d5668-2914-4f15-b2ed-01fb686c3761",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0"
                                        ]
                                    },
                                    "type": {
                                        "coding": [
                                            {
                                                "code": "EHCPOL",
                                                "system": "http://nphies.sa/terminology/CodeSystem/coverage-type",
                                                "display": "Extended healthcare"
                                            }
                                        ]
                                    },
                                    "class": [
                                        {
                                            "name": "Insurance Plan",
                                            "type": {
                                                "coding": [
                                                    {
                                                        "code": "plan",
                                                        "system": "http://terminology.hl7.org/CodeSystem/coverage-class"
                                                    }
                                                ]
                                            },
                                            "value": "default-plan"
                                        }
                                    ],
                                    "payor": [
                                        {
                                            "reference": "Organization/69912bb9-020e-42ac-839b-adb11efc18c0"
                                        }
                                    ],
                                    "status": "active",
                                    "identifier": [
                                        {
                                            "value": "2000000002",
                                            "system": "http://payer.com/memberid"
                                        }
                                    ],
                                    "subscriber": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "beneficiary": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "policyHolder": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "relationship": {
                                        "coding": [
                                            {
                                                "code": "self",
                                                "system": "http://terminology.hl7.org/CodeSystem/subscriber-relationship",
                                                "display": "Self"
                                            }
                                        ]
                                    },
                                    "resourceType": "Coverage"
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Practitioner/46df4695-f059-416f-ad57-1856f50c0bd2",
                                "resource": {
                                    "id": "46df4695-f059-416f-ad57-1856f50c0bd2",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0"
                                        ]
                                    },
                                    "name": [
                                        {
                                            "use": "official",
                                            "text": "Default Practitioner",
                                            "given": [
                                                "Default"
                                            ],
                                            "family": "Practitioner"
                                        }
                                    ],
                                    "active": true,
                                    "identifier": [
                                        {
                                            "type": {
                                                "coding": [
                                                    {
                                                        "code": "MD",
                                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                                        "display": "Medical License Number"
                                                    }
                                                ]
                                            },
                                            "value": "PRACT-46df4695",
                                            "system": "http://nphies.sa/license/practitioner-license"
                                        }
                                    ],
                                    "resourceType": "Practitioner",
                                    "qualification": [
                                        {
                                            "code": {
                                                "coding": [
                                                    {
                                                        "code": "08.00",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/practice-codes",
                                                        "display": "Healthcare Professional"
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Organization/b4ea317c-fb81-4957-afa6-5c8ad0c397ac",
                                "resource": {
                                    "id": "b4ea317c-fb81-4957-afa6-5c8ad0c397ac",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-organization|1.0.0"
                                        ]
                                    },
                                    "name": "Saudi General Hospital",
                                    "type": [
                                        {
                                            "coding": [
                                                {
                                                    "code": "prov",
                                                    "system": "http://nphies.sa/terminology/CodeSystem/organization-type"
                                                }
                                            ]
                                        }
                                    ],
                                    "active": true,
                                    "address": [],
                                    "extension": [
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-provider-type",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "1",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/provider-type",
                                                        "display": "Hospital"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "identifier": [
                                        {
                                            "value": "1010613708",
                                            "system": "http://nphies.sa/license/provider-license"
                                        }
                                    ],
                                    "resourceType": "Organization"
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Organization/69912bb9-020e-42ac-839b-adb11efc18c0",
                                "resource": {
                                    "id": "69912bb9-020e-42ac-839b-adb11efc18c0",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-organization|1.0.0"
                                        ]
                                    },
                                    "name": "Saudi National Insurance",
                                    "type": [
                                        {
                                            "coding": [
                                                {
                                                    "code": "ins",
                                                    "system": "http://nphies.sa/terminology/CodeSystem/organization-type",
                                                    "display": "Insurance Company"
                                                }
                                            ]
                                        }
                                    ],
                                    "active": true,
                                    "address": [],
                                    "identifier": [
                                        {
                                            "use": "official",
                                            "type": {
                                                "coding": [
                                                    {
                                                        "code": "NII",
                                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203"
                                                    }
                                                ]
                                            },
                                            "value": "INS-FHIR",
                                            "system": "http://nphies.sa/license/payer-license"
                                        }
                                    ],
                                    "resourceType": "Organization"
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a",
                                "resource": {
                                    "id": "cc938f77-8f1b-45f8-9f3b-b403c7ebef2a",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0"
                                        ]
                                    },
                                    "name": [
                                        {
                                            "use": "official",
                                            "text": "Muhammad Khaled Abbas",
                                            "given": [
                                                "Muhammad",
                                                "Khaled"
                                            ],
                                            "family": "Abbas"
                                        }
                                    ],
                                    "active": true,
                                    "gender": "male",
                                    "_gender": {
                                        "extension": [
                                            {
                                                "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-administrative-gender",
                                                "valueCodeableConcept": {
                                                    "coding": [
                                                        {
                                                            "code": "male",
                                                            "system": "http://nphies.sa/terminology/CodeSystem/ksa-administrative-gender"
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    },
                                    "birthDate": "2010-08-19",
                                    "extension": [
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-occupation",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "business",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/occupation"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "identifier": [
                                        {
                                            "type": {
                                                "coding": [
                                                    {
                                                        "code": "PRC",
                                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                                        "display": "Permanent Resident Card"
                                                    }
                                                ]
                                            },
                                            "value": "2000000002",
                                            "system": "http://nphies.sa/identifier/iqama",
                                            "extension": [
                                                {
                                                    "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-identifier-country",
                                                    "valueCodeableConcept": {
                                                        "coding": [
                                                            {
                                                                "code": "SAU",
                                                                "system": "urn:iso:std:iso:3166",
                                                                "display": "Saudi Arabia"
                                                            }
                                                        ]
                                                    }
                                                }
                                            ]
                                        }
                                    ],
                                    "resourceType": "Patient",
                                    "maritalStatus": {
                                        "coding": [
                                            {
                                                "code": "U",
                                                "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus"
                                            }
                                        ]
                                    },
                                    "deceasedBoolean": false
                                }
                            }
                        ],
                        "timestamp": "2025-12-28T19:14:31.303Z",
                        "resourceType": "Bundle"
                    }
                },
                {
                    "fullUrl": "urn:uuid:7c3a5783-d58c-4c93-b397-811c0b8f7214",
                    "resource": {
                        "id": "7c3a5783-d58c-4c93-b397-811c0b8f7214",
                        "meta": {
                            "profile": [
                                "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"
                            ]
                        },
                        "type": "message",
                        "entry": [
                            {
                                "fullUrl": "urn:uuid:06dfb9d4-391f-48db-ac7e-c4f21304ef86",
                                "resource": {
                                    "id": "06dfb9d4-391f-48db-ac7e-c4f21304ef86",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/message-header|1.0.0"
                                        ]
                                    },
                                    "focus": [
                                        {
                                            "reference": "http://provider.com/Claim/8432c984-822a-4b3c-9873-eff86f817c4f"
                                        }
                                    ],
                                    "sender": {
                                        "type": "Organization",
                                        "identifier": {
                                            "value": "1010613708",
                                            "system": "http://nphies.sa/license/provider-license"
                                        }
                                    },
                                    "source": {
                                        "endpoint": "http://provider.com"
                                    },
                                    "destination": [
                                        {
                                            "endpoint": "http://nphies.sa/license/payer-license/INS-FHIR",
                                            "receiver": {
                                                "type": "Organization",
                                                "identifier": {
                                                    "value": "INS-FHIR",
                                                    "system": "http://nphies.sa/license/payer-license"
                                                }
                                            }
                                        }
                                    ],
                                    "eventCoding": {
                                        "code": "claim-request",
                                        "system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events"
                                    },
                                    "resourceType": "MessageHeader"
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Claim/8432c984-822a-4b3c-9873-eff86f817c4f",
                                "resource": {
                                    "id": "8432c984-822a-4b3c-9873-eff86f817c4f",
                                    "use": "claim",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/professional-claim|1.0.0"
                                        ]
                                    },
                                    "type": {
                                        "coding": [
                                            {
                                                "code": "professional",
                                                "system": "http://terminology.hl7.org/CodeSystem/claim-type"
                                            }
                                        ]
                                    },
                                    "payee": {
                                        "type": {
                                            "coding": [
                                                {
                                                    "code": "provider",
                                                    "system": "http://terminology.hl7.org/CodeSystem/payeetype"
                                                }
                                            ]
                                        }
                                    },
                                    "total": {
                                        "value": 0,
                                        "currency": "SAR"
                                    },
                                    "status": "active",
                                    "created": "2025-12-28T22:14:31+03:00",
                                    "insurer": {
                                        "reference": "Organization/69912bb9-020e-42ac-839b-adb11efc18c0"
                                    },
                                    "patient": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "subType": {
                                        "coding": [
                                            {
                                                "code": "emr",
                                                "system": "http://nphies.sa/terminology/CodeSystem/claim-subtype"
                                            }
                                        ]
                                    },
                                    "careTeam": [
                                        {
                                            "role": {
                                                "coding": [
                                                    {
                                                        "code": "primary",
                                                        "system": "http://terminology.hl7.org/CodeSystem/claimcareteamrole"
                                                    }
                                                ]
                                            },
                                            "provider": {
                                                "reference": "Practitioner/e7fd28fd-6039-47c5-b5e1-599cd418938d"
                                            },
                                            "sequence": 1,
                                            "qualification": {
                                                "coding": [
                                                    {
                                                        "code": "08.00",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/practice-codes"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "priority": {
                                        "coding": [
                                            {
                                                "code": "normal",
                                                "system": "http://terminology.hl7.org/CodeSystem/processpriority"
                                            }
                                        ]
                                    },
                                    "provider": {
                                        "reference": "Organization/b4ea317c-fb81-4957-afa6-5c8ad0c397ac"
                                    },
                                    "extension": [
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-encounter",
                                            "valueReference": {
                                                "reference": "Encounter/a8863682-8153-42ac-bb9d-db0944d15132"
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-authorization-offline-date",
                                            "valueDateTime": "2025-12-14T00:00:00+03:00"
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-episode",
                                            "valueIdentifier": {
                                                "value": "provider_EpisodeID_DUP-1766936871506-1",
                                                "system": "http://provider.com.sa/identifiers/episode"
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-accountingPeriod",
                                            "valueDate": "2025-12-01"
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier",
                                            "valueIdentifier": {
                                                "value": "BATCH-20251228-239725",
                                                "system": "http://provider.com/batch"
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number",
                                            "valuePositiveInt": 2
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period",
                                            "valuePeriod": {
                                                "end": "2025-12-28",
                                                "start": "2025-12-28"
                                            }
                                        }
                                    ],
                                    "insurance": [
                                        {
                                            "focal": true,
                                            "coverage": {
                                                "reference": "Coverage/8ed4988d-6c48-4df6-bc95-3f7a20be9378"
                                            },
                                            "sequence": 1,
                                            "preAuthRef": [
                                                "61c09b3e-e664-4ccd-bfac-ada45426cebe"
                                            ]
                                        }
                                    ],
                                    "identifier": [
                                        {
                                            "value": "DUP-1766936871506-1",
                                            "system": "http://provider.com.sa/identifiers/claim"
                                        }
                                    ],
                                    "resourceType": "Claim",
                                    "supportingInfo": [
                                        {
                                            "code": {
                                                "text": "Patient presenting for evaluation"
                                            },
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "chief-complaint",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 1
                                        },
                                        {
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "patient-history",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 2,
                                            "valueString": "No systemic disease"
                                        },
                                        {
                                            "code": {
                                                "coding": [
                                                    {
                                                        "code": "INP",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/investigation-result",
                                                        "display": "Investigation(s) not performed"
                                                    }
                                                ]
                                            },
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "investigation-result",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 3
                                        },
                                        {
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "treatment-plan",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 4,
                                            "valueString": "Analgesic Drugs"
                                        },
                                        {
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "physical-examination",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 5,
                                            "valueString": "Stable"
                                        },
                                        {
                                            "category": {
                                                "coding": [
                                                    {
                                                        "code": "history-of-present-illness",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/claim-information-category"
                                                    }
                                                ]
                                            },
                                            "sequence": 6,
                                            "valueString": "No history"
                                        }
                                    ]
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Encounter/a8863682-8153-42ac-bb9d-db0944d15132",
                                "resource": {
                                    "id": "a8863682-8153-42ac-bb9d-db0944d15132",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/encounter|1.0.0"
                                        ]
                                    },
                                    "class": {
                                        "code": "EMER",
                                        "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
                                        "display": "emergency"
                                    },
                                    "period": {
                                        "start": "2025-12-13T03:00:00+03:00"
                                    },
                                    "status": "finished",
                                    "subject": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "priority": {
                                        "coding": [
                                            {
                                                "code": "EM",
                                                "system": "http://terminology.hl7.org/CodeSystem/v3-ActPriority",
                                                "display": "emergency"
                                            }
                                        ]
                                    },
                                    "extension": [
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-triageCategory",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "U",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/triage-category",
                                                        "display": "Urgent"
                                                    }
                                                ]
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-triageDate",
                                            "valueDateTime": "2025-12-13T03:00:00+03:00"
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-emergencyArrivalCode",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "PV",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/emergency-arrival-code",
                                                        "display": "Personal Vehicle"
                                                    }
                                                ]
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-emergencyServiceStart",
                                            "valueDateTime": "2025-12-13T03:00:00+03:00"
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-transportType",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "GEMA",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/transport-type",
                                                        "display": "Ground EMS Ambulance"
                                                    }
                                                ]
                                            }
                                        },
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-serviceEventType",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "ICSE",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/service-event-type",
                                                        "display": "Initial client service event"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "identifier": [
                                        {
                                            "value": "DUP-1766936871506-1",
                                            "system": "http://prfhir.com.sa/identifiers/encounter"
                                        }
                                    ],
                                    "resourceType": "Encounter",
                                    "serviceProvider": {
                                        "reference": "Organization/b4ea317c-fb81-4957-afa6-5c8ad0c397ac"
                                    }
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Coverage/8ed4988d-6c48-4df6-bc95-3f7a20be9378",
                                "resource": {
                                    "id": "8ed4988d-6c48-4df6-bc95-3f7a20be9378",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/coverage|1.0.0"
                                        ]
                                    },
                                    "type": {
                                        "coding": [
                                            {
                                                "code": "EHCPOL",
                                                "system": "http://nphies.sa/terminology/CodeSystem/coverage-type",
                                                "display": "Extended healthcare"
                                            }
                                        ]
                                    },
                                    "class": [
                                        {
                                            "name": "Insurance Plan",
                                            "type": {
                                                "coding": [
                                                    {
                                                        "code": "plan",
                                                        "system": "http://terminology.hl7.org/CodeSystem/coverage-class"
                                                    }
                                                ]
                                            },
                                            "value": "default-plan"
                                        }
                                    ],
                                    "payor": [
                                        {
                                            "reference": "Organization/69912bb9-020e-42ac-839b-adb11efc18c0"
                                        }
                                    ],
                                    "status": "active",
                                    "identifier": [
                                        {
                                            "value": "2000000002",
                                            "system": "http://payer.com/memberid"
                                        }
                                    ],
                                    "subscriber": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "beneficiary": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "policyHolder": {
                                        "reference": "Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a"
                                    },
                                    "relationship": {
                                        "coding": [
                                            {
                                                "code": "self",
                                                "system": "http://terminology.hl7.org/CodeSystem/subscriber-relationship",
                                                "display": "Self"
                                            }
                                        ]
                                    },
                                    "resourceType": "Coverage"
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Practitioner/e7fd28fd-6039-47c5-b5e1-599cd418938d",
                                "resource": {
                                    "id": "e7fd28fd-6039-47c5-b5e1-599cd418938d",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/practitioner|1.0.0"
                                        ]
                                    },
                                    "name": [
                                        {
                                            "use": "official",
                                            "text": "Default Practitioner",
                                            "given": [
                                                "Default"
                                            ],
                                            "family": "Practitioner"
                                        }
                                    ],
                                    "active": true,
                                    "identifier": [
                                        {
                                            "type": {
                                                "coding": [
                                                    {
                                                        "code": "MD",
                                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                                        "display": "Medical License Number"
                                                    }
                                                ]
                                            },
                                            "value": "PRACT-e7fd28fd",
                                            "system": "http://nphies.sa/license/practitioner-license"
                                        }
                                    ],
                                    "resourceType": "Practitioner",
                                    "qualification": [
                                        {
                                            "code": {
                                                "coding": [
                                                    {
                                                        "code": "08.00",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/practice-codes",
                                                        "display": "Healthcare Professional"
                                                    }
                                                ]
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Organization/b4ea317c-fb81-4957-afa6-5c8ad0c397ac",
                                "resource": {
                                    "id": "b4ea317c-fb81-4957-afa6-5c8ad0c397ac",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/provider-organization|1.0.0"
                                        ]
                                    },
                                    "name": "Saudi General Hospital",
                                    "type": [
                                        {
                                            "coding": [
                                                {
                                                    "code": "prov",
                                                    "system": "http://nphies.sa/terminology/CodeSystem/organization-type"
                                                }
                                            ]
                                        }
                                    ],
                                    "active": true,
                                    "address": [],
                                    "extension": [
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-provider-type",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "1",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/provider-type",
                                                        "display": "Hospital"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "identifier": [
                                        {
                                            "value": "1010613708",
                                            "system": "http://nphies.sa/license/provider-license"
                                        }
                                    ],
                                    "resourceType": "Organization"
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Organization/69912bb9-020e-42ac-839b-adb11efc18c0",
                                "resource": {
                                    "id": "69912bb9-020e-42ac-839b-adb11efc18c0",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/insurer-organization|1.0.0"
                                        ]
                                    },
                                    "name": "Saudi National Insurance",
                                    "type": [
                                        {
                                            "coding": [
                                                {
                                                    "code": "ins",
                                                    "system": "http://nphies.sa/terminology/CodeSystem/organization-type",
                                                    "display": "Insurance Company"
                                                }
                                            ]
                                        }
                                    ],
                                    "active": true,
                                    "address": [],
                                    "identifier": [
                                        {
                                            "use": "official",
                                            "type": {
                                                "coding": [
                                                    {
                                                        "code": "NII",
                                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203"
                                                    }
                                                ]
                                            },
                                            "value": "INS-FHIR",
                                            "system": "http://nphies.sa/license/payer-license"
                                        }
                                    ],
                                    "resourceType": "Organization"
                                }
                            },
                            {
                                "fullUrl": "http://provider.com/Patient/cc938f77-8f1b-45f8-9f3b-b403c7ebef2a",
                                "resource": {
                                    "id": "cc938f77-8f1b-45f8-9f3b-b403c7ebef2a",
                                    "meta": {
                                        "profile": [
                                            "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/patient|1.0.0"
                                        ]
                                    },
                                    "name": [
                                        {
                                            "use": "official",
                                            "text": "Muhammad Khaled Abbas",
                                            "given": [
                                                "Muhammad",
                                                "Khaled"
                                            ],
                                            "family": "Abbas"
                                        }
                                    ],
                                    "active": true,
                                    "gender": "male",
                                    "_gender": {
                                        "extension": [
                                            {
                                                "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-ksa-administrative-gender",
                                                "valueCodeableConcept": {
                                                    "coding": [
                                                        {
                                                            "code": "male",
                                                            "system": "http://nphies.sa/terminology/CodeSystem/ksa-administrative-gender"
                                                        }
                                                    ]
                                                }
                                            }
                                        ]
                                    },
                                    "birthDate": "2010-08-19",
                                    "extension": [
                                        {
                                            "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-occupation",
                                            "valueCodeableConcept": {
                                                "coding": [
                                                    {
                                                        "code": "business",
                                                        "system": "http://nphies.sa/terminology/CodeSystem/occupation"
                                                    }
                                                ]
                                            }
                                        }
                                    ],
                                    "identifier": [
                                        {
                                            "type": {
                                                "coding": [
                                                    {
                                                        "code": "PRC",
                                                        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
                                                        "display": "Permanent Resident Card"
                                                    }
                                                ]
                                            },
                                            "value": "2000000002",
                                            "system": "http://nphies.sa/identifier/iqama",
                                            "extension": [
                                                {
                                                    "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-identifier-country",
                                                    "valueCodeableConcept": {
                                                        "coding": [
                                                            {
                                                                "code": "SAU",
                                                                "system": "urn:iso:std:iso:3166",
                                                                "display": "Saudi Arabia"
                                                            }
                                                        ]
                                                    }
                                                }
                                            ]
                                        }
                                    ],
                                    "resourceType": "Patient",
                                    "maritalStatus": {
                                        "coding": [
                                            {
                                                "code": "U",
                                                "system": "http://terminology.hl7.org/CodeSystem/v3-MaritalStatus"
                                            }
                                        ]
                                    },
                                    "deceasedBoolean": false
                                }
                            }
                        ],
                        "timestamp": "2025-12-28T19:14:31.307Z",
                        "resourceType": "Bundle"
                    }
                }
            ],
            "timestamp": "2025-12-28T22:14:31+03:00",
            "resourceType": "Bundle"
        },
        "response_bundle": {
            "id": "d89e27ff-a349-4160-a334-0e88af601ee7",
            "meta": {
                "profile": [
                    "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/bundle|1.0.0"
                ]
            },
            "type": "message",
            "entry": [
                {
                    "fullUrl": "http://nphies.sa/MessageHeader/51190a45-b76c-4ed9-b7e6-070a79d789d0",
                    "resource": {
                        "id": "51190a45-b76c-4ed9-b7e6-070a79d789d0",
                        "sender": {
                            "type": "Organization",
                            "identifier": {
                                "value": "NPHIES",
                                "system": "http://nphies.sa/license/nphies"
                            }
                        },
                        "source": {
                            "endpoint": "http://nphies.sa/"
                        },
                        "response": {
                            "code": "fatal-error",
                            "details": {
                                "reference": "http://nphies.sa/OperationOutcome/ba2fb8f3-d3fb-49a9-b7ce-a3402660f2e0"
                            },
                            "identifier": "e3030fd3-d3de-441a-be93-7a329a15ab5d"
                        },
                        "destination": [
                            {
                                "endpoint": "http://provider.com",
                                "receiver": {
                                    "type": "Organization",
                                    "identifier": {
                                        "value": "1010613708",
                                        "system": "http://nphies.sa/license/provider-license"
                                    }
                                }
                            }
                        ],
                        "eventCoding": {
                            "code": "batch-response",
                            "system": "http://nphies.sa/terminology/CodeSystem/ksa-message-events"
                        },
                        "resourceType": "MessageHeader"
                    }
                },
                {
                    "fullUrl": "http://nphies.sa/OperationOutcome/ba2fb8f3-d3fb-49a9-b7ce-a3402660f2e0",
                    "resource": {
                        "id": "ba2fb8f3-d3fb-49a9-b7ce-a3402660f2e0",
                        "meta": {
                            "profile": [
                                "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/operationoutcome|1.0.0"
                            ]
                        },
                        "issue": [
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[0].resource.focus[0]"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[0].resource.focus[1]"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[1].resource.extension[0].value"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[1].resource.patient"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[1].resource.insurer"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[1].resource.provider"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[1].resource.careTeam[0].provider"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "IC-00019",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "The Claim.diagnosis SHALL follow the specified cardinality within the message profile"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[1].resource.diagnosis"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[1].resource.insurance[0].coverage"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "IC-00031",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "The Claim.item SHALL follow the specified cardinality within the message profile"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[1].resource.item"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[2].resource.subject"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[2].resource.serviceProvider"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[3].resource.policyHolder"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[3].resource.subscriber"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[3].resource.beneficiary"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[1].resource.entry[3].resource.payor[0]"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[1].resource.extension[0].value"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[1].resource.patient"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[1].resource.insurer"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[1].resource.provider"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[1].resource.careTeam[0].provider"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "IC-00019",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "The Claim.diagnosis SHALL follow the specified cardinality within the message profile"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[1].resource.diagnosis"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[1].resource.insurance[0].coverage"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "IC-00031",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "The Claim.item SHALL follow the specified cardinality within the message profile"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[1].resource.item"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[2].resource.subject"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[2].resource.serviceProvider"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[3].resource.policyHolder"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[3].resource.subscriber"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[3].resource.beneficiary"
                                ]
                            },
                            {
                                "code": "business-rule",
                                "details": {
                                    "coding": [
                                        {
                                            "code": "RE-00169",
                                            "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
                                            "display": "Reference processing is not referring to a valid resource"
                                        }
                                    ]
                                },
                                "severity": "error",
                                "expression": [
                                    "Bundle.entry[2].resource.entry[3].resource.payor[0]"
                                ]
                            }
                        ],
                        "resourceType": "OperationOutcome"
                    }
                }
            ],
            "timestamp": "2025-12-28T19:14:31.636+00:00",
            "resourceType": "Bundle"
        },
        "errors": [
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[0].resource.focus[0]"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[0].resource.focus[1]"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[1].resource.extension[0].value"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[1].resource.patient"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[1].resource.insurer"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[1].resource.provider"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[1].resource.careTeam[0].provider"
            },
            {
                "code": "IC-00019",
                "message": "The Claim.diagnosis SHALL follow the specified cardinality within the message profile",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[1].resource.diagnosis"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[1].resource.insurance[0].coverage"
            },
            {
                "code": "IC-00031",
                "message": "The Claim.item SHALL follow the specified cardinality within the message profile",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[1].resource.item"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[2].resource.subject"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[2].resource.serviceProvider"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[3].resource.policyHolder"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[3].resource.subscriber"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[3].resource.beneficiary"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[1].resource.entry[3].resource.payor[0]"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[1].resource.extension[0].value"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[1].resource.patient"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[1].resource.insurer"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[1].resource.provider"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[1].resource.careTeam[0].provider"
            },
            {
                "code": "IC-00019",
                "message": "The Claim.diagnosis SHALL follow the specified cardinality within the message profile",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[1].resource.diagnosis"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[1].resource.insurance[0].coverage"
            },
            {
                "code": "IC-00031",
                "message": "The Claim.item SHALL follow the specified cardinality within the message profile",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[1].resource.item"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[2].resource.subject"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[2].resource.serviceProvider"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[3].resource.policyHolder"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[3].resource.subscriber"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[3].resource.beneficiary"
            },
            {
                "code": "RE-00169",
                "message": "Reference processing is not referring to a valid resource",
                "severity": "error",
                "expression": "Bundle.entry[2].resource.entry[3].resource.payor[0]"
            }
        ],
        "description": "",
        "submission_date": "2025-12-28T19:14:31.131Z",
        "processed_date": null,
        "created_at": "2025-12-28T19:14:09.137Z",
        "updated_at": "2025-12-28T19:14:33.811Z",
        "provider_name": "Saudi General Hospital",
        "provider_type": "Medical Center",
        "provider_nphies_id": "1010613708",
        "insurer_name": "Saudi National Insurance",
        "insurer_nphies_id": "INS-FHIR",
        "claims": [],
        "statistics": {
            "total_claims": 0,
            "approved_claims": 0,
            "pending_claims": 0,
            "rejected_claims": 0,
            "total_claim_amount": 0,
            "approved_amount": 0
        }
    },
    "error": "Batch submission failed",
    "errors": [
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[0].resource.focus[0]"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[0].resource.focus[1]"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[1].resource.extension[0].value"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[1].resource.patient"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[1].resource.insurer"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[1].resource.provider"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[1].resource.careTeam[0].provider"
        },
        {
            "severity": "error",
            "code": "IC-00019",
            "message": "The Claim.diagnosis SHALL follow the specified cardinality within the message profile",
            "expression": "Bundle.entry[1].resource.entry[1].resource.diagnosis"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[1].resource.insurance[0].coverage"
        },
        {
            "severity": "error",
            "code": "IC-00031",
            "message": "The Claim.item SHALL follow the specified cardinality within the message profile",
            "expression": "Bundle.entry[1].resource.entry[1].resource.item"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[2].resource.subject"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[2].resource.serviceProvider"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[3].resource.policyHolder"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[3].resource.subscriber"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[3].resource.beneficiary"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[1].resource.entry[3].resource.payor[0]"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[1].resource.extension[0].value"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[1].resource.patient"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[1].resource.insurer"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[1].resource.provider"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[1].resource.careTeam[0].provider"
        },
        {
            "severity": "error",
            "code": "IC-00019",
            "message": "The Claim.diagnosis SHALL follow the specified cardinality within the message profile",
            "expression": "Bundle.entry[2].resource.entry[1].resource.diagnosis"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[1].resource.insurance[0].coverage"
        },
        {
            "severity": "error",
            "code": "IC-00031",
            "message": "The Claim.item SHALL follow the specified cardinality within the message profile",
            "expression": "Bundle.entry[2].resource.entry[1].resource.item"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[2].resource.subject"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[2].resource.serviceProvider"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[3].resource.policyHolder"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[3].resource.subscriber"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[3].resource.beneficiary"
        },
        {
            "severity": "error",
            "code": "RE-00169",
            "message": "Reference processing is not referring to a valid resource",
            "expression": "Bundle.entry[2].resource.entry[3].resource.payor[0]"
        }
    ]
}