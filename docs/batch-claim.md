# Batch Claim – NPHIES Structure Guide

## 🚨 تنبيهات مهمة قبل الإرسال
المحتوى أدناه يوضح **الهيكل الصحيح** لـ Batch Claim حسب NPHIES API.

---

## ✅ الهيكل الصحيح (حسب NPHIES API)

```
Bundle (type = message)
 ├─ MessageHeader
 │   ├─ event = batch-request
 │   └─ focus → [Bundle references] ← يشير إلى Bundles الداخلية
 ├─ Bundle (Claim Request #1)
 │   ├─ MessageHeader (event = claim-request)
 │   ├─ Claim (with batch extensions)
 │   ├─ Patient
 │   ├─ Coverage
 │   └─ Organizations, Practitioner...
 └─ Bundle (Claim Request #2)
     ├─ MessageHeader (event = claim-request)
     ├─ Claim (with batch extensions)
     └─ ...
```

---

## 📌 Event Codes (من NPHIES ValueSet)

حسب [NPHIES KSA Message Events](https://portal.nphies.sa/ig/ValueSet-ksa-message-events.html):

| Code | Display | الاستخدام |
|------|---------|-----------|
| `batch-request` | Batch-Request | إرسال batch claims |
| `batch-response` | Batch Response | استقبال ردود batch |
| `claim-request` | Claim Request | داخل كل Bundle فرعي |

---

## ❌ أخطاء شائعة وحلولها

### 1️⃣ BV-00167: Focus resource type mismatch
❌ خطأ:
```json
"eventCoding": { "code": "batch-request" },
"focus": [
  { "reference": "Claim/123" }  // خطأ! batch-request يتوقع Bundles
]
```

✅ الصحيح:
```json
"eventCoding": { "code": "batch-request" },
"focus": [
  { "reference": "urn:uuid:bundle-1-id" },
  { "reference": "urn:uuid:bundle-2-id" }
]
```

### 2️⃣ IB-00251 & RE-00177: Invalid references
❌ خطأ: focus يشير إلى resources غير موجودة

✅ الصحيح: تأكد أن كل reference في focus يطابق fullUrl موجود في entries

---

## 📌 القيود الإلزامية للـ Batch

- جميع Claims يجب أن تكون:
  - لنفس Provider
  - لنفس Payer
  - من نفس Claim Type

- كل Claim يجب أن يحتوي على Batch Extensions:
  - `extension-batch-identifier` (مشترك لكل الـ batch)
  - `extension-batch-number` (مختلف لكل claim: 1, 2, 3...)
  - `extension-batch-period` (مشترك)

- الحد الأدنى: 2 claims
- الحد الأقصى: 200 claims

---

## ✅ Checklist – تصحيح قبل الإرسال

- [ ] Outer Bundle type = message
- [ ] Outer MessageHeader event = batch-request
- [ ] Focus يشير إلى fullUrl الـ Bundles الداخلية
- [ ] كل Inner Bundle يحتوي MessageHeader مع event = claim-request
- [ ] Batch Extensions موجودة في كل Claim
- [ ] Provider / Payer / Claim Type موحّد
- [ ] عدد Claims بين 2 و 200

---

## 🏁 الخلاصة
أي Batch Claim لا يلتزم بالهيكل أعلاه **سيُرفض من NPHIES**.
