# Batch Claim – NPHIES Structure Guide

## 🚨 تنبيهات مهمة قبل الإرسال
المحتوى أدناه يوضح **الهيكل الصحيح** لـ Batch Claim حسب NPHIES API.

---

## ✅ الهيكل الصحيح النهائي (Canonical Structure)

```
Bundle (type = message)
 ├─ MessageHeader
 │   ├─ eventCoding = claim-request  ← مهم جداً!
 │   └─ focus → [Claim #1, Claim #2, Claim #3]  ← متعددة
 ├─ Claim #1 (batch-number = 1, with batch extensions)
 ├─ Claim #2 (batch-number = 2, with batch extensions)
 ├─ Claim #3 (batch-number = 3, with batch extensions)
 ├─ Patient (shared)
 ├─ Coverage (shared)
 ├─ Provider Organization
 ├─ Insurer Organization
 └─ Practitioner(s)
```

---

## 📌 Event Codes - القاعدة الذهبية

| Event Code | Focus يشير إلى | الاستخدام |
|------------|----------------|-----------|
| `claim-request` | **Claim** (واحد أو أكثر) | Batch Claim |
| `batch-request` | **Bundle** | Batch Request (حالة مختلفة) |

### ⚠️ خطأ BV-00167

```
"The MessageHeader focus resource type does not match the MessageHeader eventCoding"
```

**السبب**: استخدام `batch-request` مع `focus` يشير إلى `Claim`

**الحل**: استخدام `claim-request` مع `focus` يشير إلى `Claim`

---

## ❌ أخطاء شائعة يجب تصحيحها

### 1️⃣ استخدام batch-request بدلاً من claim-request

❌ خطأ (يسبب BV-00167):
```json
"eventCoding": {
  "code": "batch-request"
},
"focus": [
  { "reference": "Claim/123" }
]
```

✅ الصحيح:
```json
"eventCoding": {
  "code": "claim-request"
},
"focus": [
  { "reference": "http://provider.com/Claim/claim-1" },
  { "reference": "http://provider.com/Claim/claim-2" }
]
```

### 2️⃣ عدم السماح بوجود Bundles داخل Batch

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

### 3️⃣ MessageHeader واحد فقط

❌ خطأ:
- MessageHeader لكل Claim

✅ الصحيح:
- **MessageHeader واحد فقط**
- خاص بالـ Batch
- لا يوجد MessageHeader داخل أي Claim

---

## 📌 Batch Extensions (إلزامية لكل Claim)

كل Claim داخل الـ Batch يجب أن يحتوي على:

```json
"extension": [
  {
    "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-identifier",
    "valueIdentifier": {
      "system": "http://provider.com/batch",
      "value": "BATCH-20251229-123456"
    }
  },
  {
    "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-number",
    "valuePositiveInt": 1
  },
  {
    "url": "http://nphies.sa/fhir/ksa/nphies-fs/StructureDefinition/extension-batch-period",
    "valuePeriod": {
      "start": "2025-12-29",
      "end": "2025-12-29"
    }
  }
]
```

| Extension | الوصف |
|-----------|-------|
| `batch-identifier` | نفس القيمة لكل Claims في الـ Batch |
| `batch-number` | مختلف لكل Claim (1, 2, 3...) |
| `batch-period` | نفس القيمة لكل Claims |

---

## 📌 قيود إلزامية للـ Batch

- جميع Claims يجب أن تكون:
  - لنفس Provider
  - لنفس Payer
  - من نفس Claim Type (oral, vision, professional, etc.)
  - Approved Prior Authorization

- الحد الأدنى: **2 claims**
- الحد الأقصى: **200 claims**

---

## ✅ Checklist – تصحيح قبل الإرسال

- [ ] `eventCoding.code = "claim-request"` (وليس batch-request)
- [ ] `focus` يشير إلى Claims مباشرة
- [ ] Bundle واحد فقط (لا Bundles داخل Bundle)
- [ ] MessageHeader واحد فقط
- [ ] Claims مباشرة داخل Bundle
- [ ] Batch Extensions موجودة في كل Claim
- [ ] Provider / Payer / Claim Type موحّد
- [ ] عدد Claims بين 2 و 200

---

## 🏁 الخلاصة

أي Batch Claim لا يلتزم بالهيكل أعلاه **سيُرفض من NPHIES** حتى لو كانت البيانات الطبية صحيحة.

**القاعدة الأساسية**: Batch Claim = `claim-request` + multiple Claims in focus
