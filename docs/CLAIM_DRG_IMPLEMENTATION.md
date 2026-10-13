# Claim DRG / MDS implementation

The Claim Details page includes an Arabic DRG / MDS editor. Draft and error claims can save incomplete data. The server validates admitted institutional episodes before sending, and returns HTTP 422 with individual field errors when incomplete or inconsistent. Outpatient encounters remain outside the scope. A saved claim bundle preview includes a validation report so incomplete drafts can be inspected.

## Database activation

Run `npm run migrate-drg` in `backend` with the application's PostgreSQL connection configured. Migration `066_claim_drg.sql` is additive and repeatable. It stores the grouping metadata, procedures and MDS fields on `claim_submissions`, plus an audit record for saves and reviewed DRG changes. It does not backfill clinical values or change FFS amounts.

Local activation was attempted during implementation; no PostgreSQL server was reachable. The migration was tested in an isolated PGlite PostgreSQL engine, including repeated execution and JSONB persistence.

## Workflow and validation

1. Create the institutional claim from its approved PA as before.
2. Open DRG / MDS and complete the admission/discharge times, actual discharge disposition, leave days, diagnoses and procedures. Dates in the editor use Saudi UTC+3. Birth date and sex come from the patient master record.
3. Enter the AR-DRG v9.0 code/description, coding-system URI from the approved grouper integration, grouper name/version and full grouping output. No placeholder coding-system URI is supplied by the application.
4. Declare the certified source and confirm that the grouping output matches this episode. Save the draft and resolve the returned errors before Send.

The normalized grouper JSON must contain `adrg`, `mdc`, `eccs`, `dcl` and `error_flags`; `dcl` and `error_flags` are arrays. Non-error grouping requires an ADRG, MDC between 0 and 23 and a non-negative ECCS. For example, a normalized output has the shape `{ "adrg": "E62", "mdc": 4, "eccs": 0, "dcl": [], "error_flags": [] }`. This illustrates shape only; actual values must come from the certified grouper.

Checks include one explicitly identified principal diagnosis, ICD-10-AM syntax/system, unique positive diagnosis sequences, admission/discharge order, age at admission, recorded sex, Saudi same-day dates, leave-day bounds and actual discharge status. Neonatal weight is required at age <=28 days even if a legacy newborn flag was not selected. Mechanical ventilation and procedures require explicit presence/absence declarations; positive hours and dated SBS v3 procedures are checked when applicable. Error DRGs require a documented explanation and remain flagged for review.

Changing a saved DRG code requires a clinical justification plus named CDS and coding-specialist reviewers. The operator identity, previous/new code, review and save snapshot are recorded transactionally. Editing MDS without explicitly reconfirming the current grouping clears its confirmation. The claim's audit history can be viewed from the panel.

The source-certification checkbox records the operator's declaration; it does not independently verify vendor certification. These checks verify completeness and internal consistency, not licensed AR-DRG grouping, catalog membership, unacceptable-principal-diagnosis lists or clinical plausibility. A certified grouper still supplies those results.

## FHIR transport and external testing

The institutional mapper emits the DRG code/description/system/version in `Claim.diagnosis.packageCode` on the principal diagnosis and procedures in `Claim.procedure`. It embeds the structured grouping output and MDS in a standard `supportingInfo` attachment (`application/json`), using the published `attachment` category. Neonatal birth weight is sent in kg and mechanical ventilation in UCUM hours when applicable. Existing FFS items and totals continue to determine payment; no DRG estimate replaces the total.

The published NPHIES institutional profile permits `diagnosis.packageCode`, `procedure`, and supporting attachments. The supplied CHI guide requires structured DRG data but does not provide a dedicated 2026 shadow-billing FHIR extension or routing contract. This standard FHIR representation must therefore be checked against the partner's current shadow-billing technical contract in its sandbox before claiming NPHIES acceptance. No live acceptance test was performed and no automatic certified grouper API is configured by this change.

Legacy batches build one claim per approved PA item. Admitted cases are blocked before a batch is marked Pending; users must create one institutional claim for the full episode and complete its DRG panel. This prevents the legacy batch route from bypassing episode-level MDS checks.

## Sources

- Supplied `CHI-DRG-ImplementationGuidelines.pdf`: sections 3.4, 4.2–4.3, 5 and 6.
- [NPHIES institutional profile JSON](https://portal.nphies.sa/ig/StructureDefinition-institutional-claim.json)
- [NPHIES claim supporting-information categories](https://portal.nphies.sa/ig/CodeSystem-claim-information-category.json)
- [NPHIES discharge dispositions](https://portal.nphies.sa/ig/CodeSystem-discharge-disposition.json)

## Verification

Run `npm test` in `backend` and `npm run build` in `frontend`. The optional migration regression can use a separately installed PGlite module by setting `DRG_PGLITE_MODULE` to its absolute `dist/index.js` path before running `tests/drg.test.js`. It uses a temporary in-memory database, never an application database.
