# NPHIES wire contract fixtures

`nphies-bundles.json` contains 14 synthetic bundles captured from the pre-fix backend at commit `7863b600e4d1c0c81bf0a784e1ad89697778a637`.

`renderBundles.js` freezes time, UUID generation, random values, and environment identifiers to compare complete JSON output reproducibly. Capturing fixtures executes mappers locally; it does not send requests to NPHIES. The historical sandbox URL in the polling fixture is wire data only.

Do not regenerate the reference from changed code merely to make tests pass. Review intentional contract changes against the original output and the applicable integration requirements first.

2026-09-14 intentional contract amendment: every Claim item (including nested batch claims) now explicitly serializes `factor: 1` rather than omitting the multiplier. The fixture was amended only for this field, not regenerated from the implementation. Non-default and zero multipliers are checked separately in `nphies-validation.test.js`. The current published profile still says factor is optional; the September 13 sandbox audit reports a rejection when it was omitted.

`profile-audit.json` is a limited audit of these synthetic wire fixtures against the ten published profiles, fetched September 14. These fixtures intentionally contain minimal clinical input and are not examples of complete clinical submissions. Missing supporting information in this report must not be filled with invented measurements. Run `node scripts/auditNphiesBundle.js path/to/request.json` from backend to check a real saved request without uploading it.
