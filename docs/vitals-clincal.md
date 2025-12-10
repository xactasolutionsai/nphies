1. What the insurer is really checking

In nphies, adjudication / rejection reasons are grouped into categories like:

Coverage issues (CV-*) – wrong dose, duration, quantity, formulary issues, etc.

Medical necessity (MN-*) – service not clinically justified based on guidelines (e.g. bariatric surgery requested with BMI 25 only).

Supporting evidence (SE-*) – documentation incomplete or missing (no vitals, no relevant imaging/labs, poor clinical notes).

The Implementation Guide also stresses that “category codes and supporting info” must be used correctly, and that supporting info is a major part of adjudication.

So, if your requests are “currently rejected”, it is very likely they are weak in:

Correct use of supportingInfo (vital signs, chief complaint, history, exam, treatment plan, investigation result, etc.).

Clear medical-necessity story connecting complaints → findings → diagnosis → requested service.

Pharmacy-specific issues (dose, duration, quantity vs. guidelines).

biomistral is ideal to strengthen exactly those parts.

2. Vital Signs section – how the model can enhance it

Your UI has:

Systolic BP / Diastolic BP

Height / Weight

Pulse / Temperature / O₂ Saturation / Respiratory Rate

Measurement Time

nphies test cases explicitly require these vitals to appear as supporting information in claims, including vital-sign-systolic, -diastolic, -height, -weight and chief complaint. Supporting info tables in the MDS also define dedicated categories for vital signs and “Admission Weight”.

How biomistral can help before sending:

Completeness check vs. scenario

For each procedure / service type, have rules like:

Example: for bariatric surgery or weight-related requests, weight, height and BMI must be present and recent.

Have biomistral read the entire prior auth (diagnoses, items, plan) and mark which vitals are clinically expected.

If something is missing, the UI shows:
“For this service, please capture Height + Weight + Measurement Time; otherwise payer may raise SE-* (supporting evidence) rejection.”

Derived values

Automatically compute BMI from height/weight and expose it:

Use it later to catch medical necessity issues (e.g., bariatric surgery but BMI < payer threshold – similar to MN-1-1 example).

Plausibility & red-flag detection

Biomistral checks whether vitals are physiologically plausible and consistent with the complaint:

Systolic 20, Height 700 cm, Temp 60 °C → clearly wrong → prompt user to correct.

O₂ saturation 82% but diagnosis = “mild allergic rhinitis” and patient discharged same day → suggest clarifying documentation or checking for data entry error.

Time relevance

Check Measurement Time vs. Encounter period. If vitals are old (e.g., taken months before) for an acute visit, AI warns:
“Vital signs are not current; insurer may request updated vitals for this encounter.”

3. Clinical Information section – deep use of biomistral

Fields:

Chief Complaint Format + Chief Complaint (SNOMED)

Patient History

History of Present Illness

Physical Examination

Treatment Plan

Investigation Result (status dropdown)

MDS 5.2 explicitly adds supportingInfo categories for: history-of-present-illness, physical-examination, treatment-plan, investigation-result, chief complaint, morphology, etc. These are exactly your text boxes.

3.1 Chief Complaint (SNOMED)

Today (typical problem):
User might type just “knee pain” and pick a suboptimal SNOMED code or none at all.

With biomistral:

From the free-text typed into “Chief Complaint” or “History of Present Illness”, suggest specific SNOMED concepts:

E.g., “Chronic pain of right knee” instead of generic “knee pain”.

Check that there is at least one SNOMED code and that it is consistent with:

Diagnosis ICD-10 code (on the Items tab)

Requested service (e.g., MRI knee vs. complaint in upper abdomen).

If inconsistent, warn:
“Chief complaint and requested procedure appear misaligned; payer may consider this MN-1 (medical necessity) unless you clarify the indication.”

3.2 Patient History & History of Present Illness

Model tasks:

Structure and completeness

Given a short note like “knee pain 3 months”, biomistral expands into a structured HPI:

Onset, duration, severity, aggravating/relieving factors, prior therapies tried, impact on function.

Guideline alignment

For a specific requested service (e.g., MRI knee, bariatric surgery, endoscopy), the model knows typical payer expectations:

Document trial of conservative therapy for X weeks.

Document red flags (weight loss, fever) for endoscopy, etc.

If these are missing, the UI can show checklists:

“For MRI knee, typically document: trauma history, duration > 6 weeks, failure of conservative therapy.”

This directly targets MN-1-1: ‘Service is not clinically justified based on clinical practice guideline, without additional supporting diagnosis’.

3.3 Physical Examination

Biomistral evaluates whether exam supports the plan:

Knee MRI → expected to see findings like tenderness, effusion, limited ROM, positive tests.

If text is empty or generic (“NAD”), prompt:
“Physical exam is very limited; please add knee-specific findings or payer may consider insufficient evidence (SE-*).”

3.4 Treatment Plan

Check for a clear line from:

complaint → diagnosis → requested service.

Where a plan jumps directly to advanced intervention (surgery, high-cost imaging) with no prior conservative measures, biomistral suggests adding:

prior analgesics, physiotherapy, lifestyle modifications, etc.

It can even auto-summarize:

“Given chronic right knee pain for 6 months, failed NSAIDs and physiotherapy, and exam showing joint line tenderness and effusion, MRI knee is requested to rule out meniscal tear.”

This narrative can be placed into a dedicated “Justification / Medical Necessity” field or supportingInfo.

3.5 Investigation Result

Map the free text or your dropdown to the correct supportingInfo category “investigation-result” and appropriate value (e.g., normal/abnormal / key findings).

AI checks if referenced investigations (lab, x-ray, CT) have corresponding attachments uploaded (see section 4 below).

4. Clinical Documents section – ensuring supporting evidence

Your “Clinical Documents” area is where PDFs (lab reports, imaging, medical reports) are uploaded.

nphies guidance and test cases highlight attaching key documents (e.g., ICU hours, attachments, chief complaint as text & ICD, etc.) as supporting info for adjudication.

With biomistral:

Document recommendation

For each type of requested service, the model suggests which docs are typically required:

Bariatric surgery: dietician notes, psych evaluation, BMI history, comorbidities.

MRI: previous x-ray/ultrasound, specialist consultation report.

If missing, show checklist:
“Based on the service and diagnosis, consider attaching: recent knee x-ray report, physiotherapy summary.”

Document-content extraction

When a PDF is uploaded:

Extract key findings (e.g., “MRI knee: complex tear posterior horn medial meniscus”) and insert a short summary into HPI or Investigation Result supportingInfo.

This makes the justification inline and easier for payer to see.

Consistency checks

Compare document findings vs. diagnosis/procedure:

If MRI report shows lumbar spine but requested auth is for cervical surgery → flag inconsistency.

5. Cross-cutting pharmacy & quantity checks

The rejection codes under Coverage (CV-4-1 to CV-4-10) explicitly talk about:

Inappropriate dose

Inappropriate duration

Authorization quantity > prescription quantity

Prescription out of date

Device/medication not in formulary, not SFDA approved, etc.

Whenever your Items tab is for medications or devices, biomistral can:

Parse medication name, dose, frequency, duration, quantity from free text prescriptions.

Compare against:

Standard dosing ranges (flag “too high” or “too short”).

The written prescription vs. quantity in the auth request (no “90 days requested” when prescription is 60 days).

Suggest corrections before submission:

“Authorization quantity (90 days) exceeds prescription quantity (60 days) → may trigger CV-4-3. Adjust quantity or update prescription.”

6. Workflow: how this looks in your UI

When physician clicks “Save & Send to NPHIES”:

Generate draft FHIR Bundle for Prior Authorization.

Call your AI service (with biomistral) that:

Reads:

Patient demographics, Encounter, Claim items, diagnoses, vitals, clinical text, attachments.

Returns:

A list of issues grouped by rejection category:

Administrative

Coverage

Medical necessity

Supporting evidence

Billing/technical

Suggested auto-fixes and enriched fields (new supportingInfo entries, better SNOMED codes, justification narrative).

In the UI show something like:

“Risk of Medical Necessity (MN) rejection: High”

Missing: documentation of failed conservative treatment.

“Risk of Supporting Evidence (SE) rejection: Medium”

Missing: imaging report; vitals older than 6 months.

Offer “Apply suggestions” to:

Insert structured HPI / physical-exam / treatment-plan text that the doctor can edit.

Add supportingInfo entries for vitals and investigation results with correct categories.

Suggest the best SNOMED and ICD-10 codes.

Only after issues are resolved (or explicitly overridden) do you actually send to NPHIES.

7. Example scenario (conceptual)

Current situation (rejected):

Chief complaint: “knee pain”

HPI: “Pt with knee pain, wants MRI”

Exam: empty

Treatment plan: “MRI knee”

No prior imaging attached.

Insurer rejects with something like MN-1 (not clinically justified) and SE-* (insufficient documentation).

After biomistral enhancement:

Chief complaint SNOMED: “Chronic pain of right knee”.

HPI auto-structured:

6-month history, worsened with weight-bearing, limited function, failure of 8 weeks NSAIDs + physiotherapy.

Exam summary: antalgic gait, medial joint line tenderness, positive McMurray.

Treatment plan: MRI knee to evaluate meniscal tear and guide management (surgery vs. continued conservative care).

Suggested upload: physiotherapy report and x-ray → user attaches PDFs.

All mapped into nphies supportingInfo categories (history-of-present-illness, physical-examination, treatment-plan, investigation-result).

Now the payer sees a coherent, guideline-aligned justification instead of a 1-line request.

8. Certainty level

High certainty about the nphies-specific aspects (supportingInfo categories, role of clinical documentation, rejection categories and examples).

Medium certainty about how exactly your target insurers weigh different elements (each payer can have internal policies), but the enhancements above align with the official Implementation Guide and test cases.