# NPHIES Test Data Seed Guide

## 📦 What's Included

The `seed_nphies_test_data.sql` file contains ready-to-use test data for NPHIES eligibility testing.

### Sample Data Summary:

| Category | Count | Details |
|----------|-------|---------|
| **Patients** | 8 | Saudi nationals with valid IDs, complete info |
| **Providers** | 5 | Hospitals, clinics, dental centers with NPHIES IDs |
| **Insurers** | 5 | Major Saudi insurance companies with NPHIES licenses |
| **Coverages** | 8 | Active policies linking patients to insurers |

---

## 🚀 How to Import

### Step 1: Open pgAdmin
1. Launch pgAdmin
2. Connect to your PostgreSQL server
3. Select your `nafes_healthcare` database

### Step 2: Open Query Tool
1. Right-click on `nafes_healthcare` database
2. Select **Tools** → **Query Tool**

### Step 3: Load the SQL File
1. Click the **Open File** icon (folder icon) in the toolbar
2. Navigate to: `backend/migrations/seed_nphies_test_data.sql`
3. Click **Open**

### Step 4: Execute
1. Click the **Execute/Run** button (▶️ Play icon) or press **F5**
2. Wait for execution to complete (should take 2-3 seconds)
3. Check the output messages at the bottom

### Expected Output:
```
=== PATIENTS ===
8 rows

=== PROVIDERS ===
5 rows

=== INSURERS ===
5 rows

=== PATIENT COVERAGES ===
8 rows

Query returned successfully:
✅ NPHIES Test Data Imported Successfully!
Note: All patients have active insurance coverage and can be used for eligibility testing
```

---

## 📋 Sample Data Details

### Patients (8 Total)

| Name | National ID | Gender | Birth Date | Marital Status |
|------|-------------|--------|------------|----------------|
| أحمد محمد العلي | 2234567890 | Male | 1985-03-15 | Married |
| فاطمة عبدالله السعد | 2345678901 | Female | 1990-07-22 | Married |
| محمد خالد القحطاني | 2456789012 | Male | 1988-11-10 | Single |
| نورة سعد المطيري | 2567890123 | Female | 1995-02-28 | Single |
| عبدالرحمن أحمد الغامدي | 2678901234 | Male | 1982-09-05 | Married |
| سارة محمد الشمري | 2789012345 | Female | 1992-12-18 | Married |
| عمر حسن العتيبي | 2890123456 | Male | 1987-04-30 | Single |
| ليلى عبدالعزيز الدوسري | 2901234567 | Female | 1993-08-14 | Single |

### Providers (5 Total)

| Provider Name | NPHIES ID | Type | Location |
|---------------|-----------|------|----------|
| مستشفى الملك فهد التخصصي | provider-license | Hospital | Riyadh |
| مركز الرعاية الطبية المتقدم | provider-license-002 | Medical Center | Riyadh |
| عيادة الدكتور أحمد محمد | provider-license-003 | Private Clinic | Riyadh |
| مستشفى المملكة | provider-license-004 | Hospital | Jeddah |
| مركز الأسنان المتخصص | provider-license-005 | Dental Clinic | Riyadh |

### Insurers (5 Total)

| Insurer Name | NPHIES ID | Status |
|--------------|-----------|--------|
| بوبا العربية للتأمين (Bupa Arabia) | payer-license | Active |
| التأمين الصحي السعودي | payer-license-002 | Active |
| تأمين مدجلف (Medgulf) | payer-license-003 | Active |
| الشركة الوطنية للتأمين | payer-license-004 | Active |
| ملاذ للتأمين (Malath) | payer-license-005 | Active |

### Patient Coverages (8 Total)

| Patient | Insurer | Policy Number | Plan Name | Coverage Type |
|---------|---------|---------------|-----------|---------------|
| أحمد محمد العلي | Bupa Arabia | POL-BUPA-001 | Premium Health Plan | EHCPOL |
| فاطمة عبدالله السعد | Saudi Insurance | POL-SI-002 | Family Health Coverage | EHCPOL |
| محمد خالد القحطاني | Medgulf | POL-MG-003 | Basic Health Plan | EHCPOL |
| نورة سعد المطيري | National Insurance | POL-NI-004 | Comprehensive Coverage | EHCPOL |
| عبدالرحمن أحمد الغامدي | Malath | POL-MAL-005 | Executive Health Plan | EHCPOL |
| سارة محمد الشمري | Bupa Arabia | POL-BUPA-006 | Standard Health Plan | EHCPOL |
| عمر حسن العتيبي | Saudi Insurance | POL-SI-007 | Premium Health Coverage | EHCPOL |
| ليلى عبدالعزيز الدوسري | Medgulf | POL-MG-008 | Enhanced Health Plan | EHCPOL |

**All coverages are:**
- ✅ Currently active
- ✅ Valid from early 2024 through end of 2025
- ✅ Properly linked with NPHIES IDs
- ✅ Ready for eligibility testing

---

## 🧪 Testing After Import

### Step 1: Verify Data in pgAdmin
```sql
-- Check all patients have coverage
SELECT 
    p.name,
    p.identifier,
    pc.policy_number,
    i.insurer_name,
    pc.plan_name
FROM patients p
JOIN patient_coverage pc ON p.patient_id = pc.patient_id
JOIN insurers i ON pc.insurer_id = i.insurer_id
ORDER BY p.name;
```

### Step 2: Test in NPHIES Eligibility Page

1. **Navigate to:** NPHIES Eligibility page
2. **Select Patient:** Choose any patient (e.g., "أحمد محمد العلي")
3. **Select Provider:** Choose any provider (e.g., "مستشفى الملك فهد التخصصي")
4. **Select Insurer:** Choose corresponding insurer (e.g., "بوبا العربية للتأمين")
5. **Coverage Auto-Loads:** The coverage dropdown will automatically populate
6. **Select Coverage:** Policy will appear (e.g., "POL-BUPA-001 - Premium Health Plan")
7. **Choose Purpose:** Check "benefits" and "validation"
8. **Click:** "Check Eligibility"
9. **Wait:** 10-60 seconds for NPHIES response
10. **Success!** Results display

---

## 🔄 Re-importing Data

If you need to clear and re-import:

### Option 1: Clear Specific Tables
```sql
TRUNCATE TABLE patient_coverage CASCADE;
DELETE FROM eligibility WHERE nphies_request_id IS NOT NULL;
DELETE FROM patients WHERE identifier IN ('2234567890', '2345678901', '2456789012', '2567890123', '2678901234', '2789012345', '2890123456', '2901234567');
DELETE FROM providers WHERE nphies_id LIKE 'provider-license%';
DELETE FROM insurers WHERE nphies_id LIKE 'payer-license%';
```

Then run the seed file again.

### Option 2: Add More Data
Just run the seed file again - it uses `ON CONFLICT DO NOTHING`, so it won't duplicate data.

---

## 🎯 Best Test Combinations

### Test Case 1: Premium Coverage
- **Patient:** أحمد محمد العلي (ID: 2234567890)
- **Provider:** مستشفى الملك فهد التخصصي
- **Insurer:** بوبا العربية للتأمين
- **Coverage:** POL-BUPA-001 (Premium Health Plan)
- **Expected:** Full benefits, in-force coverage

### Test Case 2: Family Plan
- **Patient:** فاطمة عبدالله السعد (ID: 2345678901)
- **Provider:** مركز الرعاية الطبية المتقدم
- **Insurer:** التأمين الصحي السعودي
- **Coverage:** POL-SI-002 (Family Health Coverage)
- **Expected:** Family coverage benefits

### Test Case 3: Basic Plan
- **Patient:** محمد خالد القحطاني (ID: 2456789012)
- **Provider:** عيادة الدكتور أحمد محمد
- **Insurer:** تأمين مدجلف
- **Coverage:** POL-MG-003 (Basic Health Plan)
- **Expected:** Basic coverage, limited benefits

---

## ✅ Verification Checklist

After importing, verify:

- [ ] 8 patients appear in patients table
- [ ] 5 providers with NPHIES IDs
- [ ] 5 insurers with NPHIES IDs
- [ ] 8 active patient coverages
- [ ] Patient dropdown shows all 8 patients
- [ ] Provider dropdown shows all 5 providers
- [ ] Insurer dropdown shows all 5 insurers
- [ ] Coverage dropdown populates when patient is selected
- [ ] Can submit eligibility check successfully

---

## 🐛 Troubleshooting

### "Duplicate key value" error
**Cause:** Data already exists  
**Solution:** 
```sql
-- Check existing data
SELECT COUNT(*) FROM patients WHERE identifier LIKE '2%';
SELECT COUNT(*) FROM patient_coverage;

-- If you want to replace, delete first then re-import
```

### "Coverage dropdown is empty"
**Cause:** Foreign key mismatch  
**Solution:**
```sql
-- Check coverage links
SELECT 
    pc.coverage_id,
    pc.patient_id,
    p.name,
    pc.insurer_id,
    i.insurer_name
FROM patient_coverage pc
LEFT JOIN patients p ON pc.patient_id = p.patient_id
LEFT JOIN insurers i ON pc.insurer_id = i.insurer_id
WHERE pc.is_active = true;
```

### "NPHIES ID is null"
**Cause:** Migration wasn't run or data import order  
**Solution:**
1. Run UUID migration first: `add_nphies_integration_uuid.sql`
2. Then run seed data: `seed_nphies_test_data.sql`

---

## 📁 File Location

```
backend/migrations/seed_nphies_test_data.sql
```

---

## 🎉 Ready to Test!

Once imported, you have:
- ✅ 8 patients with complete profiles
- ✅ 5 healthcare providers
- ✅ 5 insurance companies
- ✅ 8 active insurance policies
- ✅ All data properly linked with NPHIES IDs
- ✅ Ready for real eligibility API testing

**Next Step:** Go to NPHIES Eligibility page and start testing! 🚀

