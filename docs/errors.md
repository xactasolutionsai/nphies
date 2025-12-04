[NPHIES] ===== OUTGOING REQUEST =====
[NPHIES] Request Bundle ID: ef4d9d43-cecd-4aeb-8231-0bc367394c95
[NPHIES] Request Bundle Type: message
[NPHIES] Request Bundle Entries: 8
[NPHIES] MessageHeader event: priorauth-request
[NPHIES] Claim identifier: DUP-1764882527950
[NPHIES] =============================
[NPHIES] Sending prior authorization request (attempt 1/3)
[NPHIES] Response received: 200
[NPHIES] ===== INCOMING RESPONSE =====
[NPHIES] Response Bundle ID: 3660ff71-7594-47ae-8065-1f2fd04a3a5a
[NPHIES] Response Bundle Type: message
[NPHIES] Response Bundle Entries: 6
[NPHIES] ClaimResponse ID: 261
[NPHIES] ClaimResponse outcome: error
[NPHIES] ClaimResponse preAuthRef: undefined
[NPHIES] ClaimResponse has extensions: false count: undefined
[NPHIES] ==============================
[BaseMapper] OperationOutcome found: false
[BaseMapper] ===== Parsing NPHIES Response =====
[BaseMapper] Response bundle type: Bundle
[BaseMapper] Response bundle has entries: true count: 6
[BaseMapper] ClaimResponse found: true
[BaseMapper] ClaimResponse.id: 261
[BaseMapper] ClaimResponse.outcome: error
[BaseMapper] ClaimResponse has extension: false count: undefined
[BaseMapper] ClaimResponse.error: [
  {
    "code": {
      "coding": [
        {
          "system": "http://nphies.sa/terminology/CodeSystem/adjudication-error",
          "code": "BV-00163",
          "display": "The main resource identifier SHALL be unique on the HCP/HIC level"
        }
      ]
    }
  }
]
[BaseMapper] Found adjudication extension: false
[BaseMapper] Adjudication extension full value: undefined
[BaseMapper] Extracted adjudicationOutcome: undefined
[BaseMapper] =====================================
[PriorAuth] ===== NPHIES Response Parsing =====
[PriorAuth] Prior Auth ID: 27
[PriorAuth] Parsed outcome: error
[PriorAuth] Parsed adjudicationOutcome: undefined
[PriorAuth] Parsed success: false
[PriorAuth] Parsed preAuthRef: undefined
[PriorAuth] Parsed errors: [
  {
    code: 'BV-00163',
    message: 'The main resource identifier SHALL be unique on the HCP/HIC level',
    location: undefined
  }
]
[PriorAuth] Calculated newStatus: denied
[PriorAuth] =====================================