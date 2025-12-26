-- Debug query to check mother_patient_id in eligibility and prior_authorizations
-- Replace 'c1871551-bb8f-4499-9822-7ca391b170dc' with the actual patient_id (newborn patient)

-- Check eligibility table
SELECT 
    eligibility_id,
    patient_id,
    mother_patient_id,
    created_at,
    status
FROM eligibility 
WHERE patient_id = 'c1871551-bb8f-4499-9822-7ca391b170dc'
ORDER BY created_at DESC;

-- Check if any eligibility records have mother_patient_id
SELECT 
    COUNT(*) as total_records,
    COUNT(mother_patient_id) as records_with_mother_id
FROM eligibility 
WHERE patient_id = 'c1871551-bb8f-4499-9822-7ca391b170dc';

-- Check prior_authorizations table
SELECT 
    prior_auth_id,
    patient_id,
    is_newborn,
    mother_patient_id,
    created_at,
    status
FROM prior_authorizations 
WHERE patient_id = 'c1871551-bb8f-4499-9822-7ca391b170dc'
ORDER BY created_at DESC;

-- Check if any prior_authorizations records have mother_patient_id
SELECT 
    COUNT(*) as total_records,
    COUNT(CASE WHEN is_newborn = true THEN 1 END) as newborn_records,
    COUNT(mother_patient_id) as records_with_mother_id
FROM prior_authorizations 
WHERE patient_id = 'c1871551-bb8f-4499-9822-7ca391b170dc';

-- Check the most recent eligibility record with mother_patient_id
SELECT 
    e.eligibility_id,
    e.patient_id as newborn_patient_id,
    p1.name as newborn_name,
    p1.identifier as newborn_identifier,
    e.mother_patient_id,
    p2.name as mother_name,
    p2.identifier as mother_identifier,
    e.created_at
FROM eligibility e
LEFT JOIN patients p1 ON e.patient_id = p1.patient_id
LEFT JOIN patients p2 ON e.mother_patient_id = p2.patient_id
WHERE e.patient_id = 'c1871551-bb8f-4499-9822-7ca391b170dc'
  AND e.mother_patient_id IS NOT NULL
ORDER BY e.created_at DESC
LIMIT 5;

