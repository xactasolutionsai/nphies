> تنبيه مراجعة 14 سبتمبر 2026: هذا الملف نقاش تاريخي وليس مرجع مطابقة. ملف Vision Claim الحالي يتضمن extension:encounter اختياريًا (0..1)، ولذلك عبارة «لا يحتوي نهائيًا» أدناه غير صحيحة. قائمة adjudication-error المنشورة جزئية وليست جميع أكواد نفيس. راجع NPHIES_VALIDATION_REVIEW_2026-09-14.md والـ StructureDefinitions الرسمية.

*نعم، سؤال ممتاز — والجواب: *لا يوجد Encounter مستقل إلزامي في Vision Claim كما هو موجود في (Institutional / Professional / Oral).**

## ✅ *1) هل Vision لها Encounter؟*

بعد مراجعة جميع ملفات *nphies-IG V2.7* و *MDS* و *Profiles*:

* *لا يوجد Encounter Profile خاص بـ Vision.*
* *لا يشترط وجود Claim.encounter أو Encounter.class في Vision Claims.*
* Vision تعتبر *Outpatient service* ولكنها لا تُعامَل مثل Oral أو OP بحيث ترتبط بـ Encounter.

### 🔎 *الدليل:*

* في Profiles الخاصة بالـ Claim types:

  * *Institutional* → مرتبط بـ Encounter (mandatory in claim)
  * *Professional* → مرتبط بـ Encounter
  * *Oral* → Outpatient encounter
  * *Vision* → لا يوجد أي reference لـ Encounter في الـ StructureDefinition

> ✔ الدليل من الـ MDS: Vision Claim يحتوي فقط على:
> Patient, Provider, Diagnosis (optional), Items, Benefit, Supporting Info
> *ولا يحتوي نهائياً على Encounter field*.

### 🔥 *مستوى اليقين: 95%*

لأن جميع المراجعات أكدت عدم وجود requirement، ولا يوجد أي code أو Class مرتبط بالـ Encounter داخل Vision.

---

## ✅ *2) طيب Vision تعتبر أي نوع من الخدمات؟*

Vision = *Outpatient service*
ولكن *بدون Encounter.class requirement*.

يعني حتى لو كانت Outpatient، ما في rule تقول:

> Claim.subType = OP ⇒ Encounter.class = AMB

*هذا ينطبق على Oral و Professional فقط، وليس Vision.*

---

## ✅ *3) لماذا لا يوجد Encounter في Vision؟*

لأنها تصنّف من nphies ضمن:

* خدمات بسيطة محددة items
* بدون Admission / Without clinical encounter context
* تعتمد على item coding أكثر من clinical workflow

---

## 🎯 *النتيجة النهائية:*

### ✔ *Vision Claims لا تحتوي Encounter*

### ✔ *ولا يوجد Encounter.class في Vision*

### ✔ *ولا يوجد شرط ربط بين Claim ↔ Encounter في Vision

فيه علاقة مباشرة بين *Encounter.class* وبين أنواع الـ *Claim*، و-nphies حاطّها كـ business rule في الـ IG.

## 1. القاعدة العامة

* كل *Claim* (Institutional / Professional / Oral) لازم يرتبط بـ *Encounter* عن طريق
  Claim.extension.encounter، والـ IG موضّح إنه إلزامي في الـ PA والـ Claims (institutional, professional, oral). 
* تركيبة *Claim.type + Claim.subType* تحدد أي *Encounter.class* مسموح به، كما هو مبيَّن في جدول Encounter Profile. 

## 2. المابّنج بين Claim و Encounter.class (من الـ IG)

من جدول *9.19 Encounter Profile*: 

### أ) Claim.type = Institutional

*Claim.subType = IP (Inpatient)*
يسمح بالـ Encounter.class:

* IP  → Inpatient
* SS  → Day Case

*Claim.subType = OP (Outpatient)*
يسمح بالـ Encounter.class:

* AMB → Outpatient
* HH  → Home Care
* VR  → Telemedicine

(كل هذه الخمسة ظاهرة تحت عمود الـ Institutional في الجدول: SS, IP, AMB, HH, VR) 

### ب) Claim.type = Professional

*Claim.subType = EMR (Emergency)*

* لازم يكون Encounter.class = EMER (Emergency). 

*Claim.subType = OP (Outpatient)*

* Encounter.class = AMB (Outpatient). 

ولحالات Emergency، الـ IG يربط EMR مع EMER ومع triageCategory 1–5 في جدول آخر: 

### ج) Claim.type = Dental / Oral

* الـ IG يعرّف Claim – Dental إنها *Outpatient Dental Claims* فقط، يعني دائمًا سياق خارجي (غير منوِّم). 
* بناءً على نفس منطق الجدول أعلاه، المسموح عادةً هو Encounter.class = AMB (Outpatient).

> *مستوى اليقين:* عالي لأن Dental معرف كـ Outpatient فقط، لكن الـ IG ما كتب صراحةً شرط “Dental ⇒ Encounter.class = AMB فقط”، فهذه استنتاج منطقي من التعريف، مش نص حرفي.

## 3. الكونديشن اللي تطبّقه في الفاليديشن

ممكن تكتب الـ rules (بـ pseudo-FHIRPath أو logic) بالشكل التالي:

text
1) Institutional Inpatient:
   if Claim.type = 'institutional' and Claim.subType = 'IP'
      then Encounter.class in {'IP','SS'}

2) Institutional Outpatient:
   if Claim.type = 'institutional' and Claim.subType = 'OP'
      then Encounter.class in {'AMB','HH','VR'}

3) Professional Emergency:
   if Claim.type = 'professional' and Claim.subType = 'EMR'
      then Encounter.class = 'EMER'

4) Professional Outpatient:
   if Claim.type = 'professional' and Claim.subType = 'OP'
      then Encounter.class = 'AMB'

5) Dental (Oral):
   if Claim.type = 'oral' and Claim.subType = 'OP'
      then Encounter.class = 'AMB'   // استنتاج منطقي، مش نص صريح
