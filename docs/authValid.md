1) Your question (Institutional Prior Authorization)

If your Authorization Type = Institutional (i.e., Claim.type = institutional and Claim.use = preauthorization), then:

You cannot use Claim.subType = outpatient (OP)
This will trigger business validation errors such as BV-00032 and/or BV-00364 (Institutional must not be OP and must be IP only).

You cannot use Encounter.class = outpatient (AMB)
For Institutional, Encounter.class is restricted to IMP (Inpatient Admission) or SS (Day Case / Short Stay) (not AMB). This is enforced by business rules like BV-00741 / BV-00807, and AMB is restricted to Oral/Professional by BV-00845.

What to do instead

If the case is truly outpatient: use Professional (or Oral for dental), with Claim.subType = OP.

If it is “day case” admission: you can remain Institutional, but use Encounter.class = SS and keep Claim.subType = IP.

This matches the NPHIES definition that Institutional = admitted care (inpatient + day case), while outpatient services are handled under Professional/Oral/Pharmacy/Vision.

2) Mandatory validation matrix (PriorAuth only)

Below is the minimum set of validations you should enforce in code to avoid NPHIES technical rejection for Prior Authorization (note: payers can still deny for policy/medical reasons even if validation passes).

A) Claim.type → allowed Claim.subType (BV rules)

Enforce these exactly (case-insensitive is recommended):

Institutional → IP only

BV-00364: Claim.subType SHALL only be IP when Claim.type="Institutional"

BV-00032: If Institutional then sub-type SHALL not be OP

Professional → OP or EMR only

BV-00365: sub-type SHALL be OP or EMR when Claim.type="Professional"

BV-00034: If Professional then sub-type SHALL not be IP

Oral (Dental) → OP only

BV-00366: sub-type SHALL be OP when Claim.type="oral" (displayed as Dental)

Vision → OP only

BV-00367

Pharmacy → OP only

BV-00368

(These are the canonical business rules you should map in your validator.)

B) Encounter.class rules (only where Encounter is used/required)

Key business rules:

Institutional: Encounter.class must be IMP or SS only

BV-00741 (Institutional ⇒ IMP/SS only)

BV-00807 (IMP/SS ⇒ Institutional only)

Professional: Encounter.class allowed set includes AMB, EMER, HH, VR (under claim/use claim or preauth)

BV-00742 (Professional ⇒ allowed classes)

BV-00808 (EMER/HH/VR ⇒ Professional only)

BV-00845 (AMB ⇒ only Oral or Professional)

Oral: Encounter.class must be AMB only

BV-00743 (Oral ⇒ AMB only)

BV-00845 (AMB ⇒ only Oral/Professional)

Emergency specialization inside Professional:

If Claim.subType = EMR ⇒ Encounter.class must be EMER (BV-00755)

C) Encounter “mandate” by claim type (MDS rule)

NPHIES mandates the Encounter reference in Prior Authorization for:

Institutional

Professional

Oral (Dental)

…and it is not mandated for Pharmacy and Vision.

Practical implication (very important):

For Pharmacy/Vision PriorAuth, the safest approach is do not send Encounter at all, because the encounter.class business rules heavily constrain classes to Institutional/Professional/Oral.

3) Developer checklist (implement these validations in code)
3.1 Universal (all PriorAuth types)

Message event

MessageHeader.eventCoding.code must be priorauth-request.

Claim.use

Must be preauthorization (see Institutional PriorAuth sample).

Claim.subType present + valid

Must exist (mandated in MDS).

Must be from claim-subtype code system/value set (binding + datatype + cardinality checks):

DT-00214 (datatype)

IB-00043 (binding)

IC-01566 (cardinality)

3.2 Institutional PriorAuth (type = institutional)

Validate:

Claim.subType == IP (BV-00364 / BV-00032)

Encounter is required (MDS)

Encounter.class in {IMP, SS} only (BV-00741 / BV-00807)

Do not use Encounter.class=AMB (fails BV-00845)

3.3 Professional PriorAuth (type = professional)

Validate:

Claim.subType in {OP, EMR} (BV-00365 / BV-00034)

Encounter is required (MDS)

Encounter.class must comply:

Allowed: AMB, EMER, HH, VR (BV-00742)

If subType=EMR then class must be EMER (BV-00755)

3.4 Oral/Dental PriorAuth (type = oral)

Validate:

Claim.subType == OP (BV-00366)

Encounter is required (MDS)

Encounter.class == AMB (BV-00743 + BV-00845)

If dental tooth-specific: include bodysite/tooth indication (FDI oral region) per test cases.

3.5 Pharmacy PriorAuth (type = pharmacy)

Validate:

Claim.subType == OP (BV-00368)

Days-supply supportingInfo rules (very commonly enforced in payer testing and NPHIES scenarios):
Provide supportingInfo(category=days-supply) and link each item using Claim.item.informationSequence.

Encounter is not mandated for Pharmacy (MDS)
Recommended: omit Encounter entirely.

3.6 Vision PriorAuth (type = vision)

Validate:

Claim.subType == OP (BV-00367)

Include VisionPrescription resource (required by test scenarios for optical centers).

Encounter is not mandated for Vision (MDS)
Recommended: omit Encounter entirely.