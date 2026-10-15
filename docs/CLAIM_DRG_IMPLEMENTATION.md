# Claim DRG / MDS implementation

The Claim Details page includes an Arabic DRG / MDS editor. Draft and error claims can save incomplete data. The server validates admitted institutional episodes before sending, and returns HTTP 422 with individual field errors when incomplete or inconsistent. Outpatient encounters remain outside the scope. A saved claim bundle preview includes a validation report so incomplete drafts can be inspected.

## Database activation

Run `npm run migrate-drg` in `backend` with the application's PostgreSQL connection configured. Migration `066_claim_drg.sql` is additive and repeatable. It stores the grouping metadata, procedures and MDS fields on `claim_submissions`, plus an audit record for saves and reviewed DRG changes. It does not backfill clinical values or change FFS amounts.

Migration 066 was activated on the restored server on 2026-10-13. Synthetic transactional verification confirmed save/read, JSON persistence and audit records; test records were rolled back. The migration also passed isolated PGlite tests.

## Workflow and validation

1. Create the institutional claim from its approved PA as before.
2. Open DRG / MDS and complete the admission/discharge times, actual discharge disposition, leave days, diagnoses and procedures. Dates in the editor use Saudi UTC+3. Birth date and sex come from the patient master record.
3. Enter the AR-DRG v9.0 code/description, coding-system URI from the approved grouper integration, grouper name/version and full grouping output. The UI fixes the NPHIES coding system to http://nphies.sa/terminology/CodeSystem/drg, established by the official June 2026 UC-03 sample.
4. Declare the certified source and confirm that the grouping output matches this episode. Save the draft and resolve the returned errors before Send.

The normalized grouper JSON must contain `adrg`, `mdc`, `eccs`, `dcl` and `error_flags`; `dcl` and `error_flags` are arrays. Non-error grouping requires an ADRG, MDC between 0 and 23 and a non-negative ECCS. For example, a normalized output has the shape `{ "adrg": "E62", "mdc": 4, "eccs": 0, "dcl": [], "error_flags": [] }`. This illustrates shape only; actual values must come from the certified grouper.

Checks include one explicitly identified principal diagnosis, ICD-10-AM syntax/system, unique positive diagnosis sequences, admission/discharge order, age at admission, recorded sex, Saudi same-day dates, leave-day bounds and actual discharge status. Neonatal weight is required at age <=28 days even if a legacy newborn flag was not selected. Mechanical ventilation and procedures require explicit presence/absence declarations; positive hours and dated SBS v3 procedures are checked when applicable. Error DRGs require a documented explanation and remain flagged for review.

Changing a saved DRG code requires a clinical justification plus named CDS and coding-specialist reviewers. The operator identity, previous/new code, review and save snapshot are recorded transactionally. Editing MDS without explicitly reconfirming the current grouping clears its confirmation. A server-owned fingerprint also detects later changes to the patient record or MDS, and the send reservation rejects a concurrent grouping change. The claim's audit history can be viewed from the panel.

The source-certification checkbox records the operator's declaration; it does not independently verify vendor certification. These checks verify completeness and internal consistency, not licensed AR-DRG grouping, catalog membership, unacceptable-principal-diagnosis lists or clinical plausibility. A certified grouper still supplies those results.

## FHIR transport and external testing

The institutional mapper emits a zero-valued first DRG item using `http://nphies.sa/terminology/CodeSystem/drg`, with the official code display from the supplied grouping result. It shifts FFS sequences by one and preserves their prices and the claim total. Stored request metadata allows response processing to reverse the shift and skip the synthetic DRG financial row. Procedures remain in `Claim.procedure`. It preserves structured grouping output and MDS as JSON text in `supportingInfo.valueString` with category `info`. This is provisional transport, not a verified replacement for the current DRG release mapping. The sandbox rejects application/json attachments. Admitted claims now require a PDF/JPEG attachment; missing attachment creation dates are populated from the episode discharge date. Package flags are removed recursively from DRG claim items. Neonatal birth weight is sent in kg and mechanical ventilation in UCUM hours when applicable. Existing FFS items and totals continue to determine payment; no DRG estimate replaces the total.

The published NPHIES institutional profile permits `diagnosis.packageCode`, `procedure`, and supporting attachments. However, the live sandbox test on 2026-10-13 rejected the institutional baseline for provider 1010613708: BV-01346 requires exactly one DRG code in the first claim item, BV-01198 disallows package flags for DRG claims, and BV-01200 requires an attachment for admitted care. The current diagnosis-only DRG placement is insufficient for this provider. Final wire mapping needs the current shadow-billing technical contract, including DRG terminology and first-item financial treatment, plus a certified synthetic grouper case. No DRG acceptance or automated grouper certification is claimed. See `RESTORE_DRG_RESULT_2026-10-13.md`.

Legacy batches build one claim per approved PA item. Admitted cases are blocked before a batch is marked Pending; users must create one institutional claim for the full episode and complete its DRG panel. This prevents the legacy batch route from bypassing episode-level MDS checks.

## Sources

- Supplied `CHI-DRG-ImplementationGuidelines.pdf`: sections 3.4, 4.2–4.3, 5 and 6.
- [NPHIES institutional profile JSON](https://portal.nphies.sa/ig/StructureDefinition-institutional-claim.json)
- [NPHIES claim supporting-information categories](https://portal.nphies.sa/ig/CodeSystem-claim-information-category.json)
- [NPHIES discharge dispositions](https://portal.nphies.sa/ig/CodeSystem-discharge-disposition.json)

## Verification

For the deployed host, `deploy/apply_drg_migration.mjs` runs with the application's explicit environment configuration: `node --env-file=/etc/nafes/app.env /path/to/apply_drg_migration.mjs`. Deploy the updated backend and migration file first; the script defaults to `/opt/nafes/current/backend`. It takes a private full database backup under `/var/backups/nafes`, applies the migration transactionally, verifies all 17 columns and the audit table, and checks that claim counts and FFS totals remain unchanged. Its verification report distinguishes a committed migration from a later evidence-file failure. Remote activation succeeded on 2026-10-13. The root-run restore used `DRG_BACKUP_AS_POSTGRES=true` for the local full backup because the application role cannot read the separate advisory schema. Application privileges were not broadened for backup.

Run `npm test` in `backend` and `npm run build` in `frontend`. The optional migration regression can use a separately installed PGlite module by setting `DRG_PGLITE_MODULE` to its absolute `dist/index.js` path before running `tests/drg.test.js`. It uses a temporary in-memory database, never an application database.

## Published correction — 2026-10-13

The tested drgValidation.js correction was deployed with a rollback copy at `/var/backups/nafes/drg-wire-patch-20261013/drgValidation.before.js`. Published SHA-256: `7abc4a36e21016cd86dd19805b322a31694dac5dab24409a13b1cd6a7af5c4e6`. Service active, HTTPS 200, synthetic database verification passed. Local tests: 82 passed, 4 skipped, zero failed.

The follow-up synthetic wire probe used the published helper and an experimental first DRG item (the latter remains confined to the test script). Claim `TEST-16cf5c95-2ec7-419d-b13a-1d589644f69b` returned HTTP 200, acknowledgement ok, outcome error, accepted false, with IB-00030 at item[0].productOrService. Evidence: `/var/backups/nafes/sandbox-2026-10-13T13-54-31-965Z`. The current code system/value-set and first-item financial mapping remain unresolved pending OBA v3.5 and official June 2026 JSON samples.


## Official OBA v3.5 correction (supersedes earlier terminology blocker)

Authenticated Academy downloads were obtained on 2026-10-13:
- OBA v3.5, 25 June 2026: SHA256 828628a49285789552cb63709ae4d696944c6015b0c6ca0da9895a72fe6cbcdb.
- DRG JSON Samples, 29 June 2026: SHA256 7175b7f4f9d17f456b46c342ff876cc2d4524e0b6a424e018668f0779c6b3a4b.

Section 7.14 (PDF pages 133–134) and UC-03 establish zero DRG net during shadow billing, zero detail net, and positive separate non-DRG billing. UC-03 uses system /CodeSystem/drg, E62B, display RESPIR INFECTN/INFLAMM, MINC. Changing the old /diagnosis-related-group system removed IB-00030; adding the exact display removed BV-01185.

The new mapper and response sequence handling, plus UI system default, were deployed. Rollback: /var/backups/nafes/drg-oba35-before.tgz. Backend SHA256 0b87b4ff1c8185a42c67e2c38a7ff4ba683ea8418014feb6035f6c9d85f5856d; frontend index SHA256 a76f2068e643f7e44ff6c801f46a6d3a079ad09837aa2d04575847bd76882581. Local tests: 83 passed, 4 skipped, zero failed; frontend build passed. Remote synthetic database verification passed and rolled back; service active, HTTPS 200.

Published-mapper synthetic test TEST-009d0833-463d-437b-99ee-3e25eb15b720: HTTP200, correlated ack ok, queued, no errors. Evidence: /var/backups/nafes/sandbox-2026-10-13T14-15-59-997Z. Earlier identical mapper test TEST-1c998351-a89f-459e-801e-d7e6f722fe83 received a correlated status response indicating remittance-outcome complete. Its targeted poll returned no ClaimResponse. Thus technical validation is passed for this synthetic fixture, but final adjudication approval/payment and certified clinical grouping are NOT established. No global insecure-sandbox flag or polling setting was enabled.

## Attachment validation correction and Grouper preparation — 2026-10-13

The saved-claim reader now passes loaded attachments and supporting information into validateDrg. Previously, it returned those fields to the browser but omitted them from its validation call, reporting DRG_ATTACHMENT even when a PDF/JPEG had been saved. The send path already used the complete claim. A regression test reproduced the failure before the fix and passed afterward; empty/unsupported attachments still fail. A rolled-back PostgreSQL test on the server confirmed a persisted attachment is recognized and uncertified grouping still blocks sending with 422.

GET /api/claim-submissions/:id/grouper-input is authenticated and read-only, with Cache-Control: no-store. It validates saved MDS independently of an existing DRG assignment and returns a versioned INTERNAL envelope (nafes.grouper-input v1). The DRG panel can download this JSON. The envelope includes classification versions, source fingerprint, demographics necessary for grouping, diagnoses, procedures, episode dates/disposition, leave days, birth weight in grams and ventilation hours. Names, patient identifiers, notes, attachments and financial items are excluded. This is not a published CHI/vendor request schema, and exporting does not call a provider or certify a result.

Live Grouper integration remains unconfigured. After obtaining a provider's actual API contract and authorized sandbox access, implement its input/output mapping, verify AR-DRG 9.0/SBS v3 certification, compare certified reference cases, and persist full outputs with source version and fingerprint before enabling automatic submission. No LLM-generated or invented DRG is substituted when grouping is unavailable.

Public-source research did not establish a free CHI-certified AR-DRG v9/SBS v3 API. The CHI vendor list (https://www.chi.gov.sa/Rules/Pages/ar-drg.aspx) describes AR-DRG v9/SBS v2 certification; the Lean product page (https://lean.sa/ar/products-and-solutions/drg) directs users to a demo/contact process without publishing a free API. This does not prove no subsidized or account-only service exists. Verification of access, pricing and the exact certified version remains outstanding. Rollback: /var/backups/nafes/drg-attachment-preparation-before.tgz.
