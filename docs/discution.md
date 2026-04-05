⚠️ المشاكل في الخطة (مهم جدًا)
❌ المشكلة 1: Fix 1 (auto swap) خطير

الكود هذا:

if (shadowIsValid) {
  // swap
}
❗ المشكلة:

أنت عم تفترض إنو:

إذا shadow_code valid → هو NPHIES code

⚠️ هذا مش دايمًا صحيح

سيناريو خطير:
user code accidentally matches real NPHIES code
shadow_code = internal code

👉 هون رح تعمل swap غلط ❌

✅ الحل الصحيح

❌ لا تعتمد على validation فقط
✔️ اعتمد على system ownership

🔥 التعديل المقترح:

بدل logic تبعك:

const isValid = await this.isValidNphiesCode(item.product_or_service_code, system);
const shadowIsValid = await this.isValidNphiesCode(item.shadow_code, system);
✔️ استخدم:
const isPrimaryNphies = item.product_or_service_system?.includes('nphies.sa');
const isShadowProvider = item.shadow_code_system?.includes('provider');

if (!isPrimaryNphies && isShadowProvider) {
  // reversed → swap
}
❌ المشكلة 2: Missing system fields in swap

أنت بتعمل swap للـ code بس:

item.product_or_service_code = item.shadow_code;

❗ بس ما بتبدل:

system ❌
display ❌
✅ لازم يكون swap كامل:
const temp = {
  code: item.product_or_service_code,
  display: item.product_or_service_display,
  system: item.product_or_service_system
};

item.product_or_service_code = item.shadow_code;
item.product_or_service_display = item.shadow_code_display;
item.product_or_service_system = item.shadow_code_system;

item.shadow_code = temp.code;
item.shadow_code_display = temp.display;
item.shadow_code_system = temp.system;
❌ المشكلة 3: Fix 2 ممتاز لكن ناقص شرط مهم

أنت عملت:

await shadowBillingService.processItems(...)
❗ المشكلة:

ممكن تعيد المعالجة مرتين (double processing)

✅ الحل:
if (!priorAuth._shadowProcessed) {
  await shadowBillingService.processItems(...);
  priorAuth._shadowProcessed = true;
}
❌ المشكلة 4: Mapper logging ضعيف
console.warn(...)

❗ هذا ما بكفي

✅ الأفضل:

اعمل validation حقيقي (optional strict mode):

if (system.includes('nphies.sa') && !isValidNphiesCode(code)) {
  throw new Error('Invalid NPHIES code detected in mapper');
}

أو:

if (process.env.STRICT_NPHIES === 'true') {
  throw ...
}
❌ المشكلة 5: ما عندك “single source of truth”

حاليًا:

service بيعدل
controller بيعدل
mapper بيحاول يفهم

❗ هذا خطر

✅ الحل الأفضل (مهم جدًا)
خلي shadowBillingService هو المصدر الوحيد للحقيقة

وكل الباقي:

controller → call only
mapper → dumb (no logic)
✨ النسخة المعدلة من الخطة (مختصرة)
🔥 Fix 1 (معدل)
❌ لا تعتمد على validation
✔️ اعتمد على system
if (isReversedBySystem(item)) {
  swapFull(item);
}
🔥 Fix 2 (معدل)
if (!item._shadowProcessed) {
  await shadowBillingService.processItems(...)
}
🔥 Fix 3 (معدل)
logging + optional strict validation
🔥 إضافة مهمة (ناقصة عندك)
Fix 4: enforce correct structure
normalizeCoding(item) {
  // always:
  // coding[0] → nphies
  // coding[1] → provider
