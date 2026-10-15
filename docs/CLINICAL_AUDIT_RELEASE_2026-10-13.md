# Clinical documentation audit — 13 October 2026

## Delivered

Claim Assistant now has an explicit local clinical review mode alongside the existing API assistant. The backend validates the mode. Clinical mode uses the installed English OpenMed disease extractor, even when an external API is configured, without sending notes externally. Verified source spans are compared with saved diagnosis descriptions. Basic sentence-prefix heuristics flag negation, history, differential and uncertainty. All findings require human review; no diagnosis, code, DRG, claim or submission is changed.

This is experimental text review, not clinical validation. It does not read attachments, perform semantic ICD equivalence, resolve all negation/history cases, review Arabic notes locally, or implement an AR-DRG grouper. API explanations remain available separately.

## Candidate evaluation

Script: `deploy/benchmark_medical_ner.py`. Evidence: `output/medical-ner-benchmark-20261013.json`.

Compared Genzeon healthcare-brain-diagnosis-icd-ner revision c204b8af18f79253a8b93ee90402595449b1593f with installed OpenMed disease weights, using the same Transformers pipeline and five synthetic English cases. This convenience sample is not a clinical benchmark. Candidate found all seven expected disease mentions, versus six complete mentions with the current model (one fragmented phrase). Candidate also labelled a negated mention PRIMARY_DIAGNOSIS, family history CHRONIC_CONDITION, and the generic word "medical" COMPLICATION. Its amoxicillin/COMPLICATION output scored 0.45. The current model produced no entity on the negative-control case. These measurements do not establish superiority or real-world accuracy. Candidate was retained only in `/var/tmp/nafes-ner-candidate`, outside the app. No candidate remote code or pickle weights were loaded.

Decision: keep existing local extractor for advisory mentions; do not deploy the candidate as a diagnosis classifier. No Arabic or Saudi grouper capability is inferred from either model.

Source: https://huggingface.co/genzeonplatform/healthcare-brain-diagnosis-icd-ner (publisher declares Apache-2.0 and English; clinical claims not independently verified).

## Verification and deployment

- Backend suite: 102 tests, 97 passed, 5 environment-dependent skipped. Focused audit tests rerun after adding differential-context handling: 3 passed.
- Frontend production build passed; existing chunk-size and future Vite loader warnings remain.
- Actual CPU worker through review service: 10.355 seconds, two synthetic context findings, unchanged input, no external transmission.
- Authenticated deployed HTTPS clinical review completed, claim unchanged. Invalid mode rejected with 400; anonymous review rejected with 401.
- Existing configured API review completed in 11.82 seconds, claim unchanged.
- Service active. Rollback archive: `/var/backups/nafes/before-clinical-audit-20261013.tgz` (prior routes, review service, frontend build). The added standalone helper is inert after restoring the old service.

## English video

`output/video/xacta-ai-english-20261013/XACTA-AI-Platform-English.mp4`: 105.42 seconds, 1920x1080, 24 fps, H.264/AAC. General capability names; experimental English review and unconnected grouper explicitly labelled. Illustrated walkthrough, not live screen recording. Free local rendering, English synthesized narration, original low-level music. Full decode passed; four decoded frames visually inspected. Audio peak -1.9 dB, mean -21.8 dB. English subtitle file included.
