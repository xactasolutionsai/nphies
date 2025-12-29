# Batch Claim – Required Structural Corrections (nphies)

## 🚨 تنبيهات مهمة قبل الإرسال
المحتوى أدناه يوضح **التعديلات الإلزامية** على تنفيذ Batch Claim حتى يكون **متوافق 100% مع nphies**.

---

## ❌ أخطاء شائعة يجب تصحيحها

### 1️⃣ عدم السماح بوجود Bundles داخل Batch
❌ غير مسموح:
```
Bundle (Batch)
 ├─ Bundle (Claim 1)
 ├─ Bundle (Claim 2)
```

✅ الصحيح:
```
Bundle (type = message)
 ├─ MessageHeader
 ├─ Claim #1
 ├─ Claim #2
 ├─ Claim #3
```

> Batch Claim يجب أن يكون **Bundle واحد فقط** يحتوي Claims مباشرة.

---

### 2️⃣ MessageHeader واحد فقط
❌ خطأ:
- MessageHeader لكل Claim

✅ الصحيح:
- **MessageHeader واحد فقط**
- خاص بالـ Batch
- لا يوجد MessageHeader داخل أي Claim

---

### 3️⃣ MessageHeader.focus يجب أن يشير إلى Claims مباشرة
❌ خطأ:
```json
"focus": [
  { "reference": "urn:uuid:Bundle1" },
  { "reference": "urn:uuid:Bundle2" }
]
```

✅ الصحيح:
```json
"focus": [
  { "reference": "urn:uuid:claim-1" },
  { "reference": "urn:uuid:claim-2" }
]
```

---

### 4️⃣ Event Code يجب أن يكون Batch Claim معتمد
- يجب استخدام **Event Code خاص بالـ Batch Claim**
- ويكون موجود ضمن:
```
ValueSet: ksa-message-events
```
- أي Event غير معتمد سيؤدي إلى رفض الطلب.

---

## ✅ الهيكل الصحيح النهائي (Canonical Structure)

```
Bundle (type = message)
 ├─ MessageHeader
 │   ├─ event = batch-request
 │   └─ focus → Claim references (fullUrl of each Claim)
 ├─ Claim (batch-number = 1, with batch extensions)
 ├─ Claim (batch-number = 2, with batch extensions)
 ├─ Claim (batch-number = 3, with batch extensions)
 ├─ Patient (shared resources)
 ├─ Coverage
 ├─ Provider Organization
 ├─ Insurer Organization
 └─ Practitioner(s)
```

> **ملاحظة**: NPHIES يستخدم `batch-request` للإرسال و `batch-response` للرد

---

## 📌 تذكير بالقيود الإلزامية للـ Batch

- جميع Claims يجب أن تكون:
  - لنفس Provider
  - لنفس Payer
  - من نفس Claim / Prior Auth Type

- كل Claim يجب أن يحتوي:
  - Batch Identifier (مشترك)
  - Batch Number (مختلف)
  - Batch Period (مشترك)

---

## ✅ Checklist – تصحيح قبل الإرسال

- [ ] Bundle واحد فقط
- [ ] لا يوجد Bundles داخل Bundle
- [ ] MessageHeader واحد فقط
- [ ] MessageHeader.focus يشير إلى Claims
- [ ] Claims مباشرة داخل Bundle
- [ ] Batch Extensions موجودة في كل Claim
- [ ] Provider / Payer / Claim Type موحّد
- [ ] Event Code معتمد من nphies
- [ ] لا يوجد MessageHeader داخل Claim

---

## 🏁 الخلاصة
أي Batch Claim لا يلتزم بالهيكل أعلاه **سيُرفض من nphies** حتى لو كانت البيانات الطبية صحيحة.
