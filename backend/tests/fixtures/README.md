# NPHIES wire contract fixtures

`nphies-bundles.json` contains 14 synthetic bundles captured from the pre-fix backend at commit `7863b600e4d1c0c81bf0a784e1ad89697778a637`.

`renderBundles.js` freezes time, UUID generation, random values, and environment identifiers to compare complete JSON output reproducibly. Capturing fixtures executes mappers locally; it does not send requests to NPHIES. The historical sandbox URL in the polling fixture is wire data only.

Do not regenerate the reference from changed code merely to make tests pass. Review intentional contract changes against the original output and the applicable integration requirements first.

2026-09-14 intentional contract amendment: every Claim item (including nested batch claims) now explicitly serializes `factor: 1` rather than omitting the multiplier. The fixture was amended only for this field, not regenerated from the implementation. Non-default and zero multipliers are checked separately in `nphies-validation.test.js`. The current published profile still says factor is optional; the September 13 sandbox audit reports a rejection when it was omitted.

`profile-audit.json` is a limited audit of these synthetic wire fixtures against the ten published profiles, fetched September 14. These fixtures intentionally contain minimal clinical input and are not examples of complete clinical submissions. Missing supporting information in this report must not be filled with invented measurements. Run `node scripts/auditNphiesBundle.js path/to/request.json` from backend to check a real saved request without uploading it.

2026-09-26 intentional contract amendment (mapper review fixes). The fixture was regenerated after reviewing every difference against the previous reference; the synthetic input (`clinicalInput.js`) gained a practitioner (license `TEST-PRACTITIONER`), a provider location license (`TEST-LOCATION`), an estimated length of stay, a discharge disposition and synthetic claim narratives (`Synthetic ...`), because the mappers no longer invent these values. `renderBundles.js` now passes the batch identifier and period under the keys the batch mapper reads. Intended wire changes:
- Payer Organization identifier, eligibility MessageHeader destination and cancel destination use `insurer.nphies_id` (`TEST-INSURER`) instead of the hardcoded `INS-FHIR`; the eligibility provider license is `provider.nphies_id`.
- Practitioner resources carry the supplied license, name and specialty instead of `PRACT-xxxx` / "Default Practitioner".
- Coverage `class` is omitted when no plan is known (no `default-plan` / `Standard` placeholder).
- Professional prior-auth and claim bundles include a `Location` (provider location license) and `Claim.facility` references `Location/...` instead of the provider Organization.
- Professional and pharmacy claim narratives and investigation result come from the input, not defaults ("No systemic disease", "Analgesic Drugs", "INP", ...).
- Pharmacy claims keep the user's chief-complaint entry; the per-item days-supply entry is renumbered after it and the item's `informationSequence` follows.
- Oral claim items link to supporting info (`informationSequence`); the oral claim Encounter identifier is the claim number instead of a random `AB####` value.
- Cancel: Task identifier system and `Task.focus.identifier.system` use the same `http://<provider>.com.sa/identifiers/...` derivation as the submitted `Claim.identifier`; the Task identifier is unique per attempt; `MessageHeader.source.endpoint` is `http://provider.com` like every other message.
- Eligibility: request identifier and resource id are UUID-based; `created` is the request date, not the service date; the Location identifier is the provider's location license (no `GACH` placeholder).
- Poll and eligibility `Bundle.timestamp` are Saudi-offset instants (`+03:00`).
- Batch: nested claims carry the batch identifier and period.
