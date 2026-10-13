# Claim DRG / MDS implementation

The Claim Details page includes an Arabic DRG / MDS editor. Draft and error claims can save incomplete data. The server validates admitted institutional episodes before sending, and returns HTTP 422 with individual field errors when incomplete or inconsistent. Outpatient encounters remain outside the scope. A saved claim bundle preview includes a validation report so incomplete drafts can be inspected.

## Database activation

Run `npm run migrate-drg` in `backend` with the application's PostgreSQL connection configured. Migration `066_claim_drg.sql` is additive and repeatable. It stores the grouping metadata, procedures and MDS fields on `claim_submissions`, plus an audit record for saves and reviewed DRG changes. It does not backfill clinical values or change FFS amounts.

Migration 066 was activated on the restored server on 2026-10-13. Synthetic transactional verification confirmed save/read, JSON persistence and audit records; test records were rolled back. The migration also passed isolated PGlite tests.

## Workflow and validation

1. Create the institutional claim from its approved PA as before.
2. Open DRG / MDS and complete the admission/discharge times, actual discharge disposition, leave days, diagnoses and procedures. Dates in the editor use Saudi UTC+3. Birth date and sex come from the patient master record.
3. Enter the AR-DRG v9.0 code/description, coding-system URI from the approved grouper integration, grouper name/version and full grouping output. No placeholder coding-system URI is supplied by the application.
4. Declare the certified source and confirm that the grouping output matches this episode. Save the draft and resolve the returned errors before Send.

The normalized grouper JSON must contain `adrg`, `mdc`, `eccs`, `dcl` and `error_flags`; `dcl` and `error_flags` are arrays. Non-error grouping requires an ADRG, MDC between 0 and 23 and a non-negative ECCS. For example, a normalized output has the shape `{ "adrg": "E62", "mdc": 4, "eccs": 0, "dcl": [], "error_flags": [] }`. This illustrates shape only; actual values must come from the certified grouper.

Checks include one explicitly identified principal diagnosis, ICD-10-AM syntax/system, unique positive diagnosis sequences, admission/discharge order, age at admission, recorded sex, Saudi same-day dates, leave-day bounds and actual discharge status. Neonatal weight is required at age <=28 days even if a legacy newborn flag was not selected. Mechanical ventilation and procedures require explicit presence/absence declarations; positive hours and dated SBS v3 procedures are checked when applicable. Error DRGs require a documented explanation and remain flagged for review.

Changing a saved DRG code requires a clinical justification plus named CDS and coding-specialist reviewers. The operator identity, previous/new code, review and save snapshot are recorded transactionally. Editing MDS without explicitly reconfirming the current grouping clears its confirmation. A server-owned fingerprint also detects later changes to the patient record or MDS, and the send reservation rejects a concurrent grouping change. The claim's audit history can be viewed from the panel.

The source-certification checkbox records the operator's declaration; it does not independently verify vendor certification. These checks verify completeness and internal consistency, not licensed AR-DRG grouping, catalog membership, unacceptable-principal-diagnosis lists or clinical plausibility. A certified grouper still supplies those results.

## FHIR transport and external testing

The institutional mapper emits the DRG code/description/system/version in `Claim.diagnosis.packageCode` on the principal diagnosis and procedures in `Claim.procedure`. It preserves structured grouping output and MDS as JSON text in `supportingInfo.valueString` with category `info`. This is provisional transport, not a verified replacement for the current DRG release mapping. The sandbox rejects application/json attachments. Admitted claims now require a PDF/JPEG attachment; missing attachment creation dates are populated from the episode discharge date. Package flags are removed recursively from DRG claim items. Neonatal birth weight is sent in kg and mechanical ventilation in UCUM hours when applicable. Existing FFS items and totals continue to determine payment; no DRG estimate replaces the total.

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
