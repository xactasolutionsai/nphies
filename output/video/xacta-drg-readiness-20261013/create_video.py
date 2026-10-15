"""DRG readiness explainer using verified platform screenshots and evidence."""
import importlib.util,asyncio,json
from pathlib import Path
ROOT=Path(__file__).parent
spec=importlib.util.spec_from_file_location('screens',ROOT.parent/'xacta-platform-screenshots-20261013/create_video.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
v=s.v;v.ROOT=ROOT;s.e.ROOT=ROOT
v.SCENES=[
 ('DRG readiness','What you need. How XACTA helps.',
  'What does it take to prepare a claim for D R G? Diagnosis related groups classify hospital episodes using coded clinical information and other episode data. In this video, actual screenshots from the Xacta demonstration platform show how the system supports preparation, review, and the next steps toward integration.'),
 ('Start with the clinical record','Diagnoses and procedures',
  'Preparation starts with a complete clinical record. Capture the principal diagnosis, additional diagnoses, and relevant procedures, using the applicable Saudi coding standards. A qualified reviewer must confirm the coding. The platform organizes this information, but field completeness alone cannot establish that every clinical code is correct.'),
 ('Complete the episode data','Minimum data set',
  'Record admission and discharge details, encounter type, discharge status, and leave days. Include birth weight and ventilation information when applicable, and attach the required supporting documents. The D R G workspace provides structured fields and checks for missing or inconsistent information, helping reviewers identify what still needs attention.'),
 ('Find gaps before sending','An actual incomplete example',
  'Here is a saved demonstration claim with incomplete D R G information. The review identifies specific missing fields and explains what the reviewer needs to check. The team can use these findings to complete the record and run the checks again. The approval badge belongs to an earlier saved demo record; it does not certify current D R G readiness.'),
 ('Review with assistance','Guided review and error explanations',
  'The claims assistant adds another layer of support. It explains documented NPHIES errors and presents review suggestions separately from rules based findings. An unknown error remains unknown until a reliable explanation is available. The assistant does not automatically edit the claim, assign a diagnosis, or submit it for payment.'),
 ('Keep evidence in view','Experimental documentation audit',
  'Experimental local review extracts terms from saved English notes and compares them with diagnosis descriptions. This actual result shows the phrase, no systemic disease. The assistant highlights the negative context for human review. These basic context checks are limited, and this feature does not read attachments or prove diagnostic accuracy.'),
 ('Connect the approved grouper','Prepared inputs. Integration pending.',
  'A compatible approved grouper is still needed to assign the Saudi A R D R G classification. Xacta can prepare and export saved episode inputs in its internal format. The remaining work is to connect the selected provider, adapt the interface, and verify results against reference cases. Automatic grouping is not connected today.'),
 ('Know what is ready','Implemented, tested, and still to complete',
  'Structured fields, completeness checks, and advisory review are implemented. Local model execution and authenticated review have been tested without changing the claim. Full readiness still requires approved grouper integration and end to end testing. A successful transmission is not final acceptance. Xacta helps your team prepare better data, review the evidence, and move toward D R G readiness with clear next steps.')
]
s.SOURCES=[
 ('dashboard.jpg',(0,80,875,800)),
 ('drg-full.jpg',(30,1680,850,2300)),
 ('drg-full.jpg',(30,1170,850,1860)),
 ('audit-full.jpg',(35,660,850,1250)),
 ('assistant.jpg',(30,260,850,670)),
 ('audit-full.jpg',(40,int(s.region['y'])-15,845,int(s.region['y'])+310)),
 ('drg-full.jpg',(30,335,850,630)),
 ('assistant.jpg',(30,260,850,670))
]
s.NOTES=[
 ['What you need','How XACTA helps'],
 ['Principal + additional','Qualified coding review'],
 ['Dates and conditional fields','Required documentation'],
 ['Missing fields are visible','Earlier demo status only'],
 ['Grounded explanations','No automatic submission'],
 ['English notes • experimental','Human review required'],
 ['Export episode inputs','Grouper not connected'],
 ['Implemented: data review','Remaining: integration + acceptance']
]
if __name__=='__main__':
 asyncio.run(s.e.voices());v.render()
 (ROOT/'XACTA-AI-Platform-Arabic.mp4').replace(ROOT/'XACTA-DRG-Readiness-English.mp4')
 (ROOT/'subtitles-ar.srt').replace(ROOT/'subtitles-en.srt')
 (ROOT/'production-notes.txt').write_text('DRG Readiness: What You Need, How XACTA Helps\nActual screenshots from the demo platform captured 13 October 2026. No new claim submission or acceptance test was performed for this video.\nThe example stays incomplete; no fabricated corrected state or approval is shown.\nImplementation evidence: docs/CLINICAL_AUDIT_RELEASE_2026-10-13.md and docs/CLAIM_DRG_IMPLEMENTATION.md.\nNarration uses general capability names, English voice and subtitles. Original interface remains as captured.\n',encoding='utf-8')
