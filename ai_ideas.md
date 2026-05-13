# NAFES AI Ideas — Issues & Opportunities

> **Purpose:** A living reference of AI-powered improvements mapped to the real recurring pain points found in the codebase and git history. All ideas use local Ollama (biomistral + medbot) and the existing pgvector + PostgreSQL stack. Priority is on eliminating submission errors and delivering analytics / approval prediction for users.

---

## Section 1 — NPHIES FHIR Compliance (Biggest Source of Errors)

The git history shows dozens of commits fixing error codes RE-00169, IC-01428, IC-01574, RE-00100, two shadow billing reverts, and multiple iterations on encounter-class mapping. These are the most expensive problems because they block submission entirely.


| #   | Idea                                 | How It Works                                                                                                                                                                                                                                                                                                 | Primary Files                                                                                              |
| --- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | **Pre-flight FHIR Bundle Validator** | Before every `POST /$process-message`, feed the bundle JSON to biomistral with a focused prompt containing the relevant NPHIES IG rules (encounter-class matching, mandatory fields, reference integrity, profile URLs). Returns field-level errors in Arabic + English before NPHIES even sees the request. | `backend/services/nphiesService.js`, `backend/services/ollamaService.js`                                   |
| 2   | **AI Error Code Explainer**          | When NPHIES returns a coded error (RE-00169, IC-01428…), retrieve the matching rule from a pgvector-indexed IG document and display a human-readable fix suggestion next to the error badge in the UI. Replaces searching through the 200-page IG PDF manually.                                              | `backend/controllers/priorAuthorizationsController.js`, `frontend/src/pages/PriorAuthorizationDetails.jsx` |
| 3   | **Bundle Diff Debugger**             | When a submission fails, AI compares the sent bundle against the nearest passing example stored in `docs/` and outputs a numbered list of structural differences. Shows exactly what field is wrong vs. what it should be.                                                                                   | `backend/services/nphiesService.js`, `docs/` folder                                                        |


---

## Section 2 — Shadow Billing Dual-Coding (Multiple Reverts)

Shadow billing caused 15+ commits including two full reverts. The root issue is fragile hand-coded mapping between internal/SBS codes and NPHIES codes, plus incorrect unlisted code selection.


| #   | Idea                                     | How It Works                                                                                                                                                                                                                                                                         | Primary Files                                                                                |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| 4   | **Semantic Code Mapper (pgvector)**      | Embed all NPHIES codes from `nphies CodeSystems.csv` into pgvector (already installed). When an internal/SBS code is entered, nearest-neighbor search returns the best NPHIES match with a similarity score. Replaces fragile hand-coded mapping tables.                             | `backend/services/shadowBillingService.js`, `backend/services/ragService.js`                 |
| 5   | **Unlisted Code Auto-Classifier**        | Feed the item description + service type to biomistral. It outputs which unlisted code applies (99999-99-99 procedures, 99999-99-91 dental, 99999-99-92 imaging…) with confidence score and rationale. Backend still makes the final decision; AI logs its recommendation for audit. | `backend/services/shadowBillingService.js`, `backend/services/priorAuthMapper/BaseMapper.js` |
| 6   | **Shadow Billing Post-Submission Audit** | After a ClaimResponse arrives, AI checks that every shadow-billed item appears correctly in both the NPHIES and internal coding fields. Flags discrepancies as a warning in the claim details page.                                                                                  | `backend/controllers/claimsController.js`, `frontend/src/pages/ClaimDetails.jsx`             |


---

## Section 3 — Ollama AI Reliability (Parsing Failures, Timeouts)

The `AI_RESPONSE_FALLBACK_IMPLEMENTATION.md` and the keyword-based fallback in `medicalValidationService.js` reveal the biggest AI problem is inconsistent response format — not the models themselves.


| #   | Idea                                   | How It Works                                                                                                                                                                                                                                                              | Primary Files                                                                                                            |
| --- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 7   | **Structured JSON Prompt Mode**        | Rewrite all Ollama prompts with a strict JSON template and few-shot examples embedded in the prompt. On JSON.parse failure, retry once with a simpler prompt. Eliminates the brittle keyword-based fallback and fixes parsing failures for common drugs like paracetamol. | `backend/services/ollamaService.js`, `backend/services/medicalValidationService.js`, `backend/services/medbotService.js` |
| 8   | **Response Caching Layer**             | Cache Ollama responses keyed by a SHA-256 hash of the prompt. Identical validation calls (same patient age + prescription values) return instantly from a new `ai_response_cache` PostgreSQL table. Cuts timeout frequency by ~60% for repeat calls.                      | `backend/services/ollamaService.js`, new migration for `ai_response_cache` table                                         |
| 9   | **Parallel RAG + Validation**          | Currently sequential: embed → retrieve → validate. Run embedding generation and a lightweight local rule check in parallel. Only await Ollama when RAG results are ready. Reduces perceived latency without changing models.                                              | `backend/services/medicalValidationService.js`, `backend/services/ragService.js`                                         |
| 10  | **Ollama Health Guard with UI Banner** | On startup and every 5 minutes, ping Ollama health endpoint. If unavailable, show a non-blocking banner in the UI ("AI features temporarily offline — forms still work"). Replaces silent 2-minute timeouts that block form submission.                                   | `backend/controllers/aiValidationController.js`, `frontend/src/components/Layout.jsx`                                    |


---

## Section 4 — Prior Auth Approval Prediction & Analytics (High Priority)

The database already captures `outcome`, `adjudication_outcome`, `disposition`, insurer ID, auth type, diagnosis codes, and total amounts for every prior auth. This is enough to build meaningful prediction and analytics.


| #   | Idea                                     | How It Works                                                                                                                                                                                                                                                                                                                         | Primary Files                                                                                             |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 11  | **Approval Probability Score**           | Use biomistral zero-shot classification on historical prior auth records (auth_type + insurer + diagnosis codes + total_amount + outcome). Show "High / Medium / Low approval likelihood" badge on the Review step of the Prior Auth form, with the top 2 risk reasons. Helps clinicians strengthen weak requests before submission. | New `backend/services/predictionService.js`, `frontend/src/pages/PriorAuthorizationForm.jsx` (Review tab) |
| 12  | **Denial Pattern Detector**              | Weekly background job clusters NPHIES error codes + ClaimResponse `disposition` text using pgvector embeddings. Surfaces the top 3 recurring denial reasons per insurer in the dashboard with a recommended corrective action. Identifies systemic problems before they compound.                                                    | `backend/routes/dashboard.js`, `frontend/src/pages/Dashboard.jsx`                                         |
| 13  | **Prior Auth Turnaround Time Predictor** | Use `created_at` vs. first-response timestamp to build a per-insurer × auth-type latency model. Show estimated response time on the Prior Auth list page ("Expect response in ~2 hours").                                                                                                                                            | `backend/routes/priorAuthorizations.js`, `frontend/src/pages/PriorAuthorizations.jsx`                     |
| 14  | **Daily AI Narrative Dashboard**         | Every morning, biomistral generates a 4-sentence plain-language summary of the previous 24 hours: total submissions, approval rate, top denial reasons, revenue at risk. Displayed as a highlighted card at the top of the Dashboard.                                                                                                | `backend/routes/dashboard.js`, `frontend/src/pages/Dashboard.jsx`                                         |
| 15  | **Anomaly Alerting**                     | Statistical baseline on claim volume, rejection rate, and cost per item per day. If a metric exceeds 2× its rolling average, biomistral interprets the spike and sends an in-app alert: "Today's pharmacy rejections are 3× the weekly average — 12 items are missing the days-supply field."                                        | `backend/scheduler/pollScheduler.js`, `frontend/src/components/Layout.jsx`                                |


---

## Section 5 — Form UX & Auto-fill (Help Users Fill Forms Correctly)

Users make coding mistakes that only surface on rejection. AI can catch these at entry time.


| #   | Idea                                        | How It Works                                                                                                                                                                                                                                       | Primary Files                                                                                                                             |
| --- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 16  | **ICD-10 Suggester from Chief Complaint**   | User types free-text complaint → biomistral returns top 3 ICD-10 codes with confidence percentages. Clickable chips pre-fill the diagnosis field. The ICD-10 table is already imported.                                                            | `backend/controllers/nphiesCodesController.js`, `frontend/src/components/general-request/steps/ServiceRequestStep.jsx`                    |
| 17  | **Chief Complaint → SNOMED Auto-Coder**     | `chief_complaint_format` already supports SNOMED + free text. AI reads free text and suggests the matching SNOMED code from the existing chief complaint reference data.                                                                           | `backend/controllers/priorAuthorizationsController.js`, `frontend/src/pages/PriorAuthorizationForm.jsx`                                   |
| 18  | **Prerequisite Justification Auto-Drafter** | `PrerequisiteJustificationPopup.jsx` already exists. Feed patient history + diagnosis + medications to biomistral to auto-draft a clinical justification paragraph. User edits and approves before submission. Saves 5–10 minutes per request.     | `backend/controllers/generalRequestValidationController.js`, `frontend/src/components/general-request/PrerequisiteJustificationPopup.jsx` |
| 19  | **Bulk Item Generator AI**                  | Bulk item generation feature already exists (commit `591b603`). Enhancement: user types a procedure name in natural language → AI generates all expected line items with NPHIES codes, quantities, and unit prices from historical claim patterns. | `frontend/src/pages/PriorAuthorizationForm.jsx`, `backend/controllers/priorAuthorizationsController.js`                                   |
| 20  | **SFDA / Medication Code Auto-Lookup**      | When a clinician types a medication name, semantic search over the `medication_codes` table (already imported) returns the correct NPHIES medication code as a suggestion. Eliminates manual code lookup.                                          | `backend/controllers/medicinesController.js`, `frontend/src/components/general-request/shared/MedicationInputWithSearch.jsx`              |


---

## Section 6 — Medication Safety Enhancement

`medbotService.js` parsing failures for common drugs and uniform severity display reduce clinical usefulness.


| #   | Idea                                          | How It Works                                                                                                                                                                                                                                          | Primary Files                                                                                                             |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 21  | **Structured Interaction Check Prompt**       | Rewrite the medbot interaction prompt with a strict JSON output schema as a few-shot example. Fixes the keyword-based fallback that misclassifies bullet points for common drugs like paracetamol. Same model, better prompt.                         | `backend/services/medbotService.js`, `backend/services/medicationSafetyService.js`                                        |
| 22  | **Interaction Severity Triage UI**            | Classify each detected interaction as `block / warn / inform` and map to a UI action: block = red stop banner, warn = yellow modal (user must acknowledge), inform = inline note. Currently all interactions show the same UI regardless of severity. | `backend/services/medicationSafetyService.js`, `frontend/src/components/general-request/shared/MedicationSafetyPanel.jsx` |
| 23  | **Drug Duplication Detector (Deterministic)** | Before calling Ollama, check if two medications share an active ingredient using the `medication_codes` table. Fast, deterministic, zero latency. Only escalate to Ollama for complex cross-class analysis.                                           | `backend/services/medicationSafetyService.js`                                                                             |


---

## Section 7 — Claim Processing & Payment


| #   | Idea                                | How It Works                                                                                                                                                                                                                     | Primary Files                                                                              |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 24  | **Payment Discrepancy Report**      | When PaymentReconciliation amount ≠ claim total, AI reads adjudication line items and generates a structured explanation: which items were denied, under which error code, and what needs correction for resubmission.           | `backend/services/paymentReconciliationService.js`, `frontend/src/pages/Payments.jsx`      |
| 25  | **Smart Resubmission Assistant**    | When a claim is denied, AI reads NPHIES error codes and drafts a corrected item list + updated supporting info. User reviews before resubmitting. Hooks into existing resubmission columns (`034_add_resubmission_columns.sql`). | `backend/controllers/claimSubmissionsController.js`, `frontend/src/pages/ClaimDetails.jsx` |
| 26  | **Dynamic Poll Interval Optimizer** | Track average response time per insurer × claim type from existing DB timestamps. Display estimated wait time on the claim list. Adjust `pollScheduler.js` interval dynamically per insurer instead of a fixed global schedule.  | `backend/scheduler/pollScheduler.js`, `backend/services/systemPollService.js`              |


---

## Section 8 — System Quality & Error Prevention


| #   | Idea                                   | How It Works                                                                                                                                                                                                                            | Primary Files                                                                                   |
| --- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 27  | **Migration Diff** **Validator**     | Before running a new migration SQL file, AI checks: NOT NULL columns without DEFAULT? Column renames missing downstream updates? Constraints that could fail on existing rows? Outputs a risk checklist before execution.               | `backend/migrations/` folder, new `backend/scripts/validateMigration.js`                        |
| 28  | **AI Test Case Generator for Mappers** | For each prior auth mapper (Institutional, Professional, Pharmacy, Dental, Vision), biomistral generates a minimal valid FHIR bundle + expected response stub as a JSON fixture. Catches regressions when mapper code changes.          | `backend/services/priorAuthMapper/` folder, new `backend/tests/` folder                         |
| 29  | **Arabic Form Field Coherence Check**  | For Arabic free-text fields (chief complaints, treatment plans), AI checks if the text is clinically coherent — not copy-pasted filler, not self-contradictory. Inline yellow warning if suspicious. Runs on blur, not every keystroke. | `backend/services/medicalValidationService.js`, `frontend/src/pages/PriorAuthorizationForm.jsx` |


---

## Recommended Implementation Phases

---

## Detailed Implementation Guide

> This section explains exactly how to build each idea — what documents to index, how to chunk them, and what code to write. The RAG infrastructure is already live in `backend/services/ragService.js` with `storeKnowledge()`, `searchKnowledge()`, and `storeBatchKnowledge()`. Use it directly.

---

### Foundation — How to Feed Documents to the AI

Before building any individual feature, you need to index your existing documentation into pgvector. All your source material is already in `docs/`.

**Documents you have and what each is used for:**

| File | Used For |
|------|----------|
| `docs/IG-NPHIES Implementation Guide V2.7 OBA.pdf` | FHIR bundle rules, mandatory fields, profile URLs — source for ideas #1, #2, #3 |
| `docs/errors.md` + `docs/errors.json` | Error code explanations (RE-00169, IC-01428…) — source for idea #2 |
| `docs/nphies CodeSystems.csv` | All NPHIES codes and descriptions — source for ideas #4, #16, #20 |
| `docs/shadow_billing_docs.md` + `docs/shadow_billing_full_guide.md` + `docs/shadow_billing_unlisted_logic.md` | Unlisted code decision rules — source for ideas #5, #6 |
| `docs/NPHIES_PriorAuthorization_Full.md` | Full prior auth bundle structure — source for ideas #1, #3, #18 |
| `docs/NPHIES_Professional_Lab_Bundle_Example.json` | A valid passing bundle example — source for idea #3 (diff debugger) |
| `docs/CodeSystem-medication-codes.json` | Medication codes — source for ideas #20, #23 |

**How to chunk and index a document (run once as a script):**

```js
// backend/scripts/indexDocuments.js
import fs from 'fs';
import ragService from '../services/ragService.js';

function chunkText(text, chunkSize = 500, overlap = 50) {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }
  return chunks;
}

async function indexMarkdownFile(filePath, category, source) {
  const text = fs.readFileSync(filePath, 'utf8');
  const chunks = chunkText(text);
  const items = chunks.map((chunk, i) => ({
    content: chunk,
    metadata: { source, chunk_index: i, file: filePath },
    category
  }));
  await ragService.storeBatchKnowledge(items);
  console.log(`Indexed ${items.length} chunks from ${filePath}`);
}

// Run for each document
await indexMarkdownFile('docs/errors.md', 'nphies_errors', 'NPHIES Error Guide');
await indexMarkdownFile('docs/NPHIES_PriorAuthorization_Full.md', 'nphies_rules', 'NPHIES IG v2.7');
await indexMarkdownFile('docs/shadow_billing_full_guide.md', 'shadow_billing', 'Shadow Billing Guide');
```

For the **PDF** (`IG-NPHIES Implementation Guide V2.7 OBA.pdf`), use `pdf-parse`:

```bash
npm install pdf-parse
```

```js
import pdfParse from 'pdf-parse';
const buffer = fs.readFileSync('docs/IG-NPHIES Implementation Guide V2.7 OBA.pdf');
const { text } = await pdfParse(buffer);
const chunks = chunkText(text);
// then storeBatchKnowledge as above with category: 'nphies_ig'
```

For the **CSV** (`nphies CodeSystems.csv`), each row becomes one entry:

```js
import { parse } from 'csv-parse/sync';
const csv = fs.readFileSync('docs/nphies CodeSystems.csv', 'utf8');
const rows = parse(csv, { columns: true });
const items = rows.map(row => ({
  content: `Code: ${row.code} | Display: ${row.display} | System: ${row.system}`,
  metadata: { code: row.code, system: row.system },
  category: 'nphies_codes'
}));
await ragService.storeBatchKnowledge(items);
```

---

### Idea #1 — Pre-flight FHIR Bundle Validator

**What documents to index:** `NPHIES_PriorAuthorization_Full.md`, the IG PDF (category: `nphies_rules`).

**How it works at runtime:**

1. In `nphiesService.js`, before `POST /$process-message`, call `ragService.searchKnowledge(bundleType + authType, 5, 'nphies_rules')` to retrieve the relevant IG rules for this bundle type.
2. Pass those rules + the bundle JSON to Ollama with this prompt structure:

```js
const rules = await ragService.searchKnowledge(
  `prior authorization ${authType} encounter-class mandatory fields`,
  5, 'nphies_rules'
);
const rulesText = rules.map(r => r.content).join('\n---\n');

const prompt = `
You are a NPHIES FHIR bundle validator. Given the rules below and the bundle JSON, 
list ONLY fields that violate the rules. Output valid JSON only.

RULES:
${rulesText}

BUNDLE:
${JSON.stringify(bundle, null, 2)}

Output format:
{"errors": [{"field": "Encounter.class", "issue": "Missing. Required for Institutional auth.", "fix": "Set to AMB for outpatient"}]}
If no errors, output: {"errors": []}
`;
```

3. Parse the JSON response and return errors to the caller before NPHIES sees the request.

**File to edit:** `backend/services/nphiesService.js` — add a `validateBundle(bundle, authType)` method that runs this before every submission call.

---

### Idea #2 — AI Error Code Explainer

**What documents to index:** `docs/errors.md` and `docs/errors.json` (category: `nphies_errors`).

**How to index `errors.json`** — it is a FHIR Bundle of error responses, so extract the error code + details text from each entry and store each as one chunk:

```js
const errorsJson = JSON.parse(fs.readFileSync('docs/errors.json', 'utf8'));
// Walk the bundle entries and pull out OperationOutcome issues
const items = [];
errorsJson.entry?.forEach(entry => {
  entry.resource?.issue?.forEach(issue => {
    items.push({
      content: `Error code: ${issue.code} | Severity: ${issue.severity} | Details: ${issue.details?.text} | Diagnostics: ${issue.diagnostics}`,
      metadata: { code: issue.code, severity: issue.severity },
      category: 'nphies_errors'
    });
  });
});
await ragService.storeBatchKnowledge(items);
```

**Runtime flow in `priorAuthorizationsController.js`:**

```js
// When a NPHIES response has errors
const errorCodes = nphiesErrors.map(e => e.code).join(' ');
const relevant = await ragService.searchKnowledge(errorCodes, 3, 'nphies_errors');
const explanation = relevant.length > 0
  ? relevant[0].content   // display raw retrieved rule — no LLM needed
  : 'No matching rule found in local knowledge base.';

// Return explanation alongside the raw error in the API response
res.json({ errors: nphiesErrors, explanations: explanation });
```

**Frontend in `PriorAuthorizationDetails.jsx`:** Show the explanation text in a collapsible panel next to each error badge. No LLM call needed — pure retrieval.

---

### Idea #3 — Bundle Diff Debugger

**What documents to index:** Index `docs/NPHIES_Professional_Lab_Bundle_Example.json` and any other valid bundle examples as full JSON strings (category: `passing_examples`).

**Runtime flow:**

1. When a submission fails, retrieve the closest passing example from pgvector using the failed bundle's `authType` + `subType` as the query.
2. Pass both JSONs to biomistral:

```js
const example = await ragService.searchKnowledge(
  `passing ${authType} prior authorization bundle`,
  1, 'passing_examples'
);

const prompt = `
Compare the FAILED bundle against the PASSING example.
List every structural difference as a numbered list.
Format: "Field X: failed has [Y], passing has [Z]"

PASSING EXAMPLE:
${example[0]?.content}

FAILED BUNDLE:
${JSON.stringify(failedBundle)}
`;
```

3. Display the numbered diff in the UI on the error details page.

---

### Idea #4 — Semantic Code Mapper (No LLM, pgvector only)

**What to index:** `docs/nphies CodeSystems.csv` — each row as one vector entry (category: `nphies_codes`). Already described in the foundation section above.

**Runtime — replace the hand-coded mapping table in `shadowBillingService.js`:**

```js
// Instead of: const nphiesCode = MAPPING_TABLE[internalCode]
// Use:
const results = await ragService.searchKnowledge(
  `${internalCode} ${description}`, 1, 'nphies_codes'
);
const bestMatch = results[0]; // similarity score is in bestMatch.similarity
if (bestMatch && bestMatch.similarity > 0.85) {
  return bestMatch.metadata.code;
} else {
  return selectUnlistedCode(serviceType); // fall through to existing unlisted logic
}
```

No Ollama call. No generation. Fast and auditable.

---

### Idea #5 — Unlisted Code Auto-Classifier

**What documents to index:** `docs/shadow_billing_unlisted_logic.md` and `docs/shadow_billing_full_guide.md` (category: `shadow_billing`).

**Runtime prompt in `shadowBillingService.js`:**

```js
const rules = await ragService.searchKnowledge(
  `unlisted code ${serviceType} ${description}`, 3, 'shadow_billing'
);
const rulesText = rules.map(r => r.content).join('\n');

const prompt = `
Given these unlisted code rules:
${rulesText}

Item description: "${description}"
Service type: "${serviceType}"

Which unlisted code applies? Output JSON only:
{"code": "99999-99-99", "rationale": "...", "confidence": 0.9}
`;
```

The backend logs the AI recommendation but the existing `selectUnlistedCode()` logic still makes the final call. AI output goes to an audit log table.

---

### Idea #7 — Structured JSON Prompt Mode

**No documents needed — this is a prompt rewrite.**

In `ollamaService.js`, wrap every prompt with a strict output contract:

```js
buildStructuredPrompt(taskDescription, inputData, outputSchema) {
  return `
You are a medical coding assistant. You MUST respond with valid JSON only. No explanation text.

TASK: ${taskDescription}

INPUT:
${JSON.stringify(inputData)}

OUTPUT SCHEMA (respond exactly like this):
${JSON.stringify(outputSchema, null, 2)}

EXAMPLE OUTPUT:
${JSON.stringify(this.getExampleFor(outputSchema))}

Respond with JSON only:`;
}
```

On `JSON.parse` failure in the caller, retry once with `max_tokens: 200` and a simpler prompt. This eliminates the keyword-based fallback in `medicalValidationService.js`.

---

### Idea #8 — Response Caching Layer (No LLM)

**Migration to add:**

```sql
CREATE TABLE ai_response_cache (
  prompt_hash TEXT PRIMARY KEY,
  response JSONB NOT NULL,
  model TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  hit_count INTEGER DEFAULT 0
);
```

**In `ollamaService.js`, wrap `generate()`:**

```js
import crypto from 'crypto';

async generateCached(prompt, model) {
  const hash = crypto.createHash('sha256').update(prompt + model).digest('hex');
  const cached = await query('SELECT response FROM ai_response_cache WHERE prompt_hash = $1', [hash]);
  if (cached.rows.length > 0) {
    await query('UPDATE ai_response_cache SET hit_count = hit_count + 1 WHERE prompt_hash = $1', [hash]);
    return cached.rows[0].response;
  }
  const result = await this.generate(prompt, model);
  await query('INSERT INTO ai_response_cache (prompt_hash, response, model) VALUES ($1, $2, $3)', [hash, result, model]);
  return result;
}
```

---

### Idea #10 — Ollama Health Guard with UI Banner (No LLM)

**In `backend/controllers/aiValidationController.js`, add a health endpoint:**

```js
export async function getAIHealth(req, res) {
  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/tags`, {
      signal: AbortSignal.timeout(3000)
    });
    const online = response.ok;
    res.json({ online, checkedAt: new Date().toISOString() });
  } catch {
    res.json({ online: false, checkedAt: new Date().toISOString() });
  }
}
```

**In `frontend/src/components/Layout.jsx`**, poll this endpoint every 5 minutes and show a banner when `online === false`:

```jsx
const [aiOnline, setAiOnline] = useState(true);
useEffect(() => {
  const check = () => fetch('/api/ai/health').then(r => r.json()).then(d => setAiOnline(d.online));
  check();
  const id = setInterval(check, 5 * 60 * 1000);
  return () => clearInterval(id);
}, []);

{!aiOnline && (
  <div className="bg-yellow-100 text-yellow-800 px-4 py-2 text-sm">
    AI features temporarily offline — forms still work normally.
  </div>
)}
```

---

### Idea #11 — Approval Probability Score

**No external documents needed — uses your own DB history.**

```js
// backend/services/predictionService.js
export async function predictApproval(authType, insurerId, diagnosisCodes, totalAmount) {
  // Pull historical outcomes from your own DB
  const history = await query(`
    SELECT outcome, adjudication_outcome, total_amount
    FROM prior_authorizations
    WHERE auth_type = $1 AND insurer_id = $2
    LIMIT 100
  `, [authType, insurerId]);

  const approvalRate = history.rows.filter(r => r.outcome === 'approved').length / history.rows.length;
  
  // Only call LLM if history is thin (< 10 records)
  if (history.rows.length >= 10) {
    return {
      score: approvalRate > 0.7 ? 'High' : approvalRate > 0.4 ? 'Medium' : 'Low',
      approvalRate: Math.round(approvalRate * 100),
      source: 'historical'
    };
  }

  // Fallback: zero-shot classification with biomistral
  const prompt = `...`;
}
```

---

### Idea #12 — Denial Pattern Detector (No LLM)

**Pure SQL — add to `backend/routes/dashboard.js`:**

```sql
SELECT 
  error_code,
  COUNT(*) as frequency,
  insurer_id,
  MAX(created_at) as last_seen
FROM prior_authorization_errors
GROUP BY error_code, insurer_id
ORDER BY frequency DESC
LIMIT 10;
```

Fetch this on dashboard load and display the top 3 per insurer as a card. No AI needed for basic version.

---

### Idea #13 — Turnaround Time Predictor (No LLM)

**Add to `backend/routes/priorAuthorizations.js`:**

```sql
SELECT 
  auth_type,
  insurer_id,
  AVG(EXTRACT(EPOCH FROM (first_response_at - created_at))/3600) as avg_hours
FROM prior_authorizations
WHERE first_response_at IS NOT NULL
GROUP BY auth_type, insurer_id;
```

Show result as "Expect response in ~X hours" on the prior auth list page.

---

### Idea #16 — ICD-10 Suggester (Embeddings only, no LLM)

**What to index:** The ICD-10 table is already imported in your DB. Export it and index it:

```js
const icd10rows = await query('SELECT code, description FROM icd10_codes');
const items = icd10rows.rows.map(row => ({
  content: `ICD-10 ${row.code}: ${row.description}`,
  metadata: { code: row.code },
  category: 'icd10'
}));
await ragService.storeBatchKnowledge(items);
```

**Runtime in `nphiesCodesController.js`:**

```js
export async function suggestICD10(req, res) {
  const { complaint } = req.query;
  const results = await ragService.searchKnowledge(complaint, 3, 'icd10');
  res.json(results.map(r => ({ code: r.metadata.code, description: r.content, score: r.similarity })));
}
```

**Frontend:** As the user types in the chief complaint field, debounce 400ms then call this endpoint and show clickable code chips below the input.

---

### Idea #18 — Prerequisite Justification Auto-Drafter

**What to index:** `docs/NPHIES_PriorAuthorization_Full.md` (already indexed as `nphies_rules`).

**In `generalRequestValidationController.js`, add an endpoint `/api/prior-auth/draft-justification`:**

```js
const rules = await ragService.searchKnowledge(
  `prerequisite justification ${diagnosisCodes.join(' ')}`, 3, 'nphies_rules'
);

const prompt = `
Draft a 3-sentence clinical justification for a prior authorization request.
Be concise and clinically specific.

Patient info:
- Diagnosis: ${diagnosisCodes.join(', ')}
- Requested service: ${serviceDescription}
- Auth type: ${authType}

Relevant policy context:
${rules.map(r => r.content).join('\n')}

Output only the justification paragraph, nothing else.
`;

const draft = await ollamaService.generate(prompt);
res.json({ draft });
```

In `PrerequisiteJustificationPopup.jsx`, add a "Generate draft" button that calls this endpoint and pre-fills the text area. User edits before submitting.

---

### Idea #20 — SFDA Medication Code Auto-Lookup (Embeddings only)

**What to index:** `docs/CodeSystem-medication-codes.json`:

```js
const medCodes = JSON.parse(fs.readFileSync('docs/CodeSystem-medication-codes.json', 'utf8'));
const items = medCodes.concept?.map(c => ({
  content: `Medication: ${c.display} | Code: ${c.code} | Definition: ${c.definition || ''}`,
  metadata: { code: c.code, display: c.display },
  category: 'medication_codes'
}));
await ragService.storeBatchKnowledge(items);
```

**Runtime in `medicinesController.js`:**

```js
export async function suggestMedicationCode(req, res) {
  const { name } = req.query;
  const results = await ragService.searchKnowledge(name, 3, 'medication_codes');
  res.json(results.map(r => ({ code: r.metadata.code, display: r.metadata.display, score: r.similarity })));
}
```

---

### Idea #21 — Structured Interaction Check Prompt

**No documents to index — this is a prompt rewrite in `medbotService.js`.**

Replace the current free-text prompt with:

```js
const prompt = `
Check for drug interactions between these medications.
Respond with valid JSON only — no text outside the JSON.

Medications: ${medications.join(', ')}

Required output:
{
  "interactions": [
    {
      "drug_a": "...",
      "drug_b": "...",
      "severity": "block|warn|inform",
      "description": "..."
    }
  ]
}

If no interactions, output: {"interactions": []}
`;
```

Parse the result with `JSON.parse`. On failure, retry once. Remove the keyword-based fallback.

---

### Idea #23 — Drug Duplication Detector (Fully deterministic)

**In `medicationSafetyService.js`, add before any Ollama call:**

```js
async function checkDuplicateIngredients(medicationCodes) {
  const result = await query(`
    SELECT a.code as code_a, b.code as code_b, a.active_ingredient
    FROM medication_codes a
    JOIN medication_codes b ON a.active_ingredient = b.active_ingredient AND a.code != b.code
    WHERE a.code = ANY($1) AND b.code = ANY($1)
  `, [medicationCodes]);

  return result.rows.map(row => ({
    drug_a: row.code_a,
    drug_b: row.code_b,
    issue: `Both contain active ingredient: ${row.active_ingredient}`,
    severity: 'block'
  }));
}
```

Call this first. Only escalate to Ollama for cross-class interactions that can't be caught by ingredient matching.

---

### Implementation Order (Based on Effort vs. Impact)

| Priority | Idea | Effort | Why First |
|----------|------|--------|-----------|
| 1 | #8 Response Caching | 2h | Reduces Ollama timeouts immediately, zero risk |
| 2 | #10 Health Guard + Banner | 2h | Eliminates silent 2-minute freezes in forms |
| 3 | #23 Drug Duplicate Detector | 1h | Pure SQL, no risk, saves Ollama calls |
| 4 | Index all docs (foundation script) | 3h | Unlocks ideas #2, #4, #16, #20 at once |
| 5 | #4 Semantic Code Mapper | 2h | Replaces the fragile shadow billing mapping table |
| 6 | #2 Error Code Explainer | 3h | Highest user pain — stops manual PDF searching |
| 7 | #7 Structured JSON Prompts | 4h | Fixes parsing failures across all AI features |
| 8 | #16 ICD-10 Suggester | 3h | High UX value, embeddings only |
| 9 | #1 Pre-flight Validator | 6h | Needs LLM but eliminates the #1 error source |
| 10 | #11 Approval Score | 4h | Analytics value, mostly SQL for existing data |

