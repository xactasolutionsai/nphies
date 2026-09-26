# بوابات خارطة طريق الذكاء الاصطناعي (AI Roadmap Gates) — المراحل 3 و4 و5

آخر تحديث: 2026-09-26. الحالة: **PASS** (تحقق بدليل) · **FAIL** (تحقق وفشل) · **UNKNOWN** (لا يمكن الحكم من هنا — يلزم تشغيل على بيئة الإنتاج).


> تقسيم المراحل حسب خطة المالك: **المرحلة 3 = البحث الدلالي (semantic search / embeddings)**، **المرحلة 4 = التنبؤ بتعلم آلي تقليدي**، **المرحلة 5 = الميزات التوليدية مع مراجعة بشرية إلزامية**. شرط المرحلة 5 يتضمن شرط المرحلة 3 كاملاً.
>
> الأدلة "المحلية" أدناه من حاوية التطوير (PostgreSQL 16 بدون pgvector، بدون Ollama)، وليست من الإنتاج.

## ما يجب على المالك تشغيله (قراءة فقط، لا يغيّر أي بيانات)

على خادم الإنتاج (أو نسخة منه) من مجلد `backend` مع ملف `.env` الفعلي:

```bash
npm run ai:readiness -- --json   > ai-readiness.json      # Ollama + النماذج + pgvector + embeddings
npm run ai:data-report           > ai-data-report.md       # حجم البيانات وجودتها (BEGIN READ ONLY)
```

- `ai:readiness`: رمز الخروج دائماً 0. يستدعي `GET /api/tags` (مهلة 3 ثوانٍ) ومرة واحدة `POST /api/embed` بالنص `test` فقط إن كان Ollama متاحاً ونموذج الـ embedding مثبتاً. لا يحذف شيئاً؛ يطبع فقط استعلام العدّ.
- `ai:data-report`: كل الاستعلامات SELECT داخل `BEGIN READ ONLY` ثم `ROLLBACK`. لا يطبع أسماء أو هويات مرضى أو أرقام طلبات؛ يطبع أسماء شركات التأمين فقط.
- أرسل الملفين الناتجين؛ تُحدَّث حالات UNKNOWN أدناه منهما.

## بوابة مشتركة: C5 — مخرجات منظمة (Structured outputs)

| الشرط | الحالة | الدليل |
|---|---|---|
| كل رد LLM يُنتج حكماً (valid/necessity/fit/interactions) يُطلب بـ Ollama `format` = JSON Schema ويُتحقق منه بنفس المخطط؛ الرد غير الصالح يُغلق بأمان (`isValid:null` / `analysisIncomplete` / `requiresManualReview`) | **PASS** | `backend/tests/ai-structured-output.test.js` (11 اختباراً، فشلت كلها على الكود السابق ثم نجحت). المُحقِّق المشترك: `services/ai/structuredOutput.js` |
| إزالة المحللات النصية (regex) وأنماط prompt-echo | **PASS** | أُزيلت من `ollamaService` و`priorAuthValidationService` و`generalRequestValidationService` و`medicationSafetyService` |
| متبقٍ خارج النطاق: `medbotService.getMedicineInformation` ما زال يحلل نصاً حراً بالـ regex لعرض معلومات دواء مرجعية (ليس حكماً ولا يُنتج "valid") | مفتوح | قرار المالك: تحويله لمخطط JSON أو إبقاؤه عرضاً نصياً فقط |

## المرحلة 3 — البحث الدلالي (Semantic search)

| # | الشرط | الحالة | الدليل / ما يلزم |
|---|---|---|---|
| 3.1 | عنوان Ollama ‏https أو loopback/private (قاعدة `services/ollamaConfig.js`) | UNKNOWN (إنتاج) | محلياً PASS لـ `http://127.0.0.1`. شغّل `ai:readiness` (البند `ollama_base_url`) |
| 3.2 | Ollama متاح (`/api/tags`) | UNKNOWN (إنتاج) · محلياً FAIL | البند `ollama_reachable` |
| 3.3 | نموذج التوليد مثبت (`OLLAMA_MODEL`) | UNKNOWN | البند `generation_model_present` |
| 3.4 | نموذج embedding مضبوط في `OLLAMA_EMBED_MODEL` ومثبت؛ وهل يوجد `bge-m3*` | UNKNOWN · محلياً FAIL (غير مضبوط) | البنود `embedding_model_configured` و`embedding_model_present` و`bge_m3_installed`. إن اعتُمد bge-m3: `ollama pull bge-m3` |
| 3.5 | بُعد الـ embedding = `EMBEDDING_DIM` = أعمدة `vector(N)` | UNKNOWN · خطر معروف | الأعمدة الحالية `vector(4096)` (biomistral). bge-m3 يُرجع عادةً 1024 بُعداً، فيلزم migration للأعمدة إن تغيّر النموذج. البند `embedding_dimension` يقيس البعد الفعلي |
| 3.6 | امتداد pgvector متاح ومثبت | UNKNOWN (إنتاج) · محلياً FAIL | البندان `pgvector_available` و`pgvector_installed`. البحث النصي (FTS) يبقى الأساس بدونه (المبدأ 7) |
| 3.7 | embeddings المخزنة سابقاً موثوقة | UNKNOWN | صفوف `medical_knowledge`/`medicines` المخزنة قبل إزالة الـ hash-fallback قد تحوي متجهات hash **ولا يمكن تمييزها بشكل موثوق**. التقرير يطبع العدد واستعلامه فقط؛ القرار (إعادة التوليد بالنموذج المختار) للمالك. لا حذف تلقائي |
| 3.8 | تأكيد المالك كتابياً أن خادم Ollama داخل الشبكة الخاصة ومع TLS (PDPL م.29) | مطلوب من المالك | لا يمكن إثباته من الكود؛ `ai:readiness` يتحقق من العنوان فقط |
| 3.9 | قرار نموذج الـ embedding (مقترح: bge-m3 بأعمدة `vector(1024)` جديدة مع فهرس HNSW، مع إبقاء أعمدة 4096 القديمة) | مطلوب من المالك | migration إضافية + سكربت إعادة توليد قابل للاستئناف بعد القرار |
| 3.10 | قائمة ICD-10-AM رسمية محمّلة (شرط لتفعيل اقتراح التشخيص فقط) | FAIL | مرخّصة؛ يوفّرها المالك. اقتراح الإجراءات/الأدوية لا يعتمد عليها |
| 3.11 | مصدر شرح أخطاء NPHIES | تنبيه | `docs/errors.md` يصرّح في رأسه أنه نقاش تاريخي وليس مرجعاً؛ لا يُفهرس كمصدر رسمي. قائمة adjudication-error الرسمية جزئية (fragment) |

## المرحلة 4 — التنبؤ (تعلم آلي تقليدي)

العتبات في `scripts/aiDataVolumeReport.js` (`DEFAULT_THRESHOLDS`) **إرشادية (heuristics) وليست ضماناً** لدقة أو عدالة أي نموذج: لكل نموذج ≥ 1000 سجل موسوم، و≥ 100 في الفئة الأقل (عادةً المرفوض)، وتغطية ≥ 12 شهراً تقويمياً (لتقسيم زمني للتقييم).

| # | الشرط | الحالة | الدليل / ما يلزم |
|---|---|---|---|
| 4.1 | رفض الموافقة المسبقة على مستوى الطلب (`pa_denial`) | UNKNOWN · محلياً FAIL (0 سجل) | قسم Sufficiency في `ai:data-report` |
| 4.2 | رفض بنود الموافقة المسبقة (`pa_item_denial`) | UNKNOWN | كما سبق |
| 4.3 | رفض المطالبة (`claim_rejection`) | UNKNOWN | كما سبق |
| 4.4 | رفض بنود المطالبة (`claim_item_denial`) | UNKNOWN | كما سبق |
| 4.5 | نسبة القيم الناقصة للخصائص المرشحة (التشخيص، رموز البنود، المبلغ، شركة التأمين، النوع، encounter_class، practitioner_license، supporting info) مقبولة | UNKNOWN | جدول "Missing rate" في التقرير؛ الحد المقبول يقرره المالك |
| 4.6 | تعريف الـ label معتمد | يحتاج قرار المالك | المستخدم حالياً: `adjudication_outcome` ‏rejected مقابل approved/partial، وإلا `status` ‏denied مقابل approved/partial(/paid). حالات error/queued/pended غير موسومة |
| 4.7 | عدد رموز الأخطاء المميزة في `*_responses.errors` كافٍ لأي تصنيف للأخطاء | UNKNOWN | سطر "Distinct error codes" في التقرير |


لا تدريب لأي نموذج قبل مراجعة المالك لتقرير `ai:data-report`. عند الكفاية: تقسيم زمني للتدريب/الاختبار، وتقرير AUC/precision/recall والمعايرة، وعرض استشاري فقط.

## المرحلة 5 — الميزات التوليدية (مراجعة بشرية إلزامية)

| # | الشرط | الحالة | الدليل / ما يلزم |
|---|---|---|---|
| 5.1 | C5 (أعلاه) | **PASS** | `tests/ai-structured-output.test.js` |
| 5.2 | تنقيح PHI قبل أي استدعاء (`services/ai/phi.js`) | **PASS** (للمسارات الجديدة) | `tests/ai-foundation.test.js`. المسارات القديمة (eye form, PA validation) ترسل العمر/الجنس لا الاسم؛ لم تُمرَّر بعد عبر `phi.js` — يُستحسن قبل التوسع |
| 5.3 | سجل التدقيق `ai_audit_log` (migration 069) مطبّق في الإنتاج | UNKNOWN | `npm run migrate -- --status` على الإنتاج |
| 5.4 | أعلام الميزات (`AI_FEATURES_ENABLED`, `AI_FEATURE_<NAME>`) مضبوطة في الإنتاج | UNKNOWN | مراجعة `.env` الإنتاج |
| 5.5 | شرط المرحلة 3 كاملاً (3.1–3.9) | UNKNOWN / مطلوب من المالك | انظر المرحلة 3 |


لا يُبنى: تجميع DRG (لا يوجد مُجمِّع AR-DRG v9 معتمد)، ولا تحليل صور الأشعة/قاع العين. أي ميزة تقترب من التشخيص أو قرار العلاج قد تقع ضمن SFDA MDS-G010 وتُعرض على المالك قبل البناء.

## ما تبقى على المالك

1. تشغيل الأمرين أعلاه على الإنتاج وإرسال النتائج.
2. اعتماد تعريف الـ label (4.6) وتأكيد أن خادم Ollama خاص ومع TLS (3.8).
3. قرار نموذج الـ embedding (bge-m3 أم غيره) ثم migration للأعمدة إن تغيّر البعد، وإعادة توليد الـ embeddings القديمة (3.7، 3.9).
4. قرار بشأن محلل `medbotService.getMedicineInformation` (C5 متبقٍ).
