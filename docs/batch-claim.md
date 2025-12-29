# Batch Claim – nphies (FHIR KSA)

## 📘 السياق العام
أنا أعمل على نظام متوافق مع **nphies (FHIR KSA)**.  
الـ Flow الحالي في النظام:

1. إرسال Prior Authorization  
2. استقبال Approved Prior Auth  
3. تحويل Approved Prior Auth إلى Claim  

المطلوب هو دعم **Batch Claim** حسب Use Case الرسمي في nphies.

---

## 🎯 الهدف
- أخذ **2 أو أكثر Approved Prior Auth**
- تحويل كل واحد منهم إلى **Claim مستقل**
- إرسال جميع الـ Claims مرة واحدة داخل **Batch Claim Bundle**

---

## 🧠 المفهوم الأساسي (مهم جدًا)
- ❌ لا يتم دمج أكثر من Prior Authorization داخل Claim واحد  
- ✅ كل Prior Authorization ينتج **Claim مستقل**
- ✅ الفرق بين Claim عادي و Batch Claim هو **طريقة الإرسال فقط**

---

## 📦 شكل الـ Batch Claim (High Level)

```
Bundle (Batch Claim Request)
 ├─ MessageHeader (event = batch-claim)
 ├─ Claim #1 (based on Approved Prior Auth #1)
 ├─ Claim #2 (based on Approved Prior Auth #2)
 ├─ Claim #3 (based on Approved Prior Auth #3)
```

---

## 📌 شو لازم تضيف زيادة عن Claim العادي؟

### 1️⃣ Claim Batch Identifier
- معرف واحد مشترك لكل الـ Claims داخل نفس الدفعة

### 2️⃣ Claim Batch Number
- رقم تسلسلي مختلف لكل Claim داخل نفس الدفعة

### 3️⃣ Claim Batch Period
- فترة زمنية واحدة مشتركة لكل الـ Claims داخل الدفعة

---

## ⚠️ قيود إلزامية (Must Follow)

- كل Claim داخل الـ Batch يجب أن يكون:
  - لنفس Provider
  - لنفس Payer
  - من نفس نوع الـ Claim

- كل Claim:
  - مبني على Approved Prior Auth خاص فيه
  - يحتوي على نفس بيانات Claim العادي

- Bundle الإرسال يجب أن يحتوي على:
  - MessageHeader خاص بالـ batch-claim
  - عدة Claim Resources

- الالتزام التام بـ:
  - FHIR Profiles الخاصة بـ nphies
  - عدم إضافة أي Extensions غير معتمدة

---

## 🔄 الاستجابة (Response Behavior)

- عند الإرسال:
  - يتم استقبال Batch Response
  - ClaimResponse لكل Claim
  - الحالات: accepted / queued / error

- الحكم النهائي (Adjudication):
  - يتم لاحقًا
  - عبر Polling
  - كل Claim يُعالَج بشكل مستقل

---

## 🧑‍💻 المطلوب من الكود
- دالة تستقبل قائمة Approved Prior Auth IDs
- إنشاء Claim لكل Prior Auth
- إضافة Batch Extensions الإلزامية
- بناء Batch Claim Bundle جاهز للإرسال

---

## ✅ Checklist – قبل إرسال Batch Claim

- [ ] جميع Prior Auths حالتها **Approved**
- [ ] كل Prior Auth تم تحويله إلى **Claim مستقل**
- [ ] لا يوجد أكثر من Prior Auth داخل Claim واحد
- [ ] جميع Claims لنفس Provider
- [ ] جميع Claims لنفس Payer
- [ ] جميع Claims من نفس نوع Claim
- [ ] Claim Batch Identifier مضاف ومشترك
- [ ] Claim Batch Number مختلف لكل Claim
- [ ] Claim Batch Period مضاف ومشترك
- [ ] MessageHeader نوعه batch-claim
- [ ] Bundle متوافق مع FHIR nphies Profiles
- [ ] لا توجد Extensions غير معتمدة
- [ ] جاهزية Polling لاستقبال Adjudication لاحقًا

---

## 🏁 الخلاصة
Batch Claim هو إرسال عدة Claims دفعة واحدة مع الحفاظ على استقلالية كل Claim في المعالجة والحكم النهائي.
