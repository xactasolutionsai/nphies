export function clinicalInput(type = 'professional') {
  const patient = { patient_id: '11111111-1111-4111-8111-111111111111', name: 'Test Patient', identifier: '1000000001', identifier_type: 'national_id', gender: 'male', birth_date: '1990-01-01' };
  const provider = { provider_id: '22222222-2222-4222-8222-222222222222', provider_name: 'Test Hospital', nphies_id: 'TEST-PROVIDER', provider_type: '1', type: 'hospital' };
  const insurer = { insurer_id: '33333333-3333-4333-8333-333333333333', insurer_name: 'Test Insurer', nphies_id: 'TEST-INSURER' };
  const coverage = { coverage_id: '44444444-4444-4444-8444-444444444444', patient_id: patient.patient_id, insurer_id: insurer.insurer_id, member_id: 'TEST-MEMBER', policy_number: 'TEST-POLICY', relationship: 'self', is_active: true, start_date: '2026-01-01', end_date: '2026-12-31' };
  const record = {
    id: 1, request_number: 'TEST-PA-1', claim_number: 'TEST-CLAIM-1', auth_type: type, claim_type: type,
    patient_id: patient.patient_id, provider_id: provider.provider_id, insurer_id: insurer.insurer_id,
    coverage_id: coverage.coverage_id, status: 'draft', priority: 'normal', currency: 'SAR', total_amount: 100,
    encounter_class: type === 'institutional' ? 'inpatient' : 'outpatient',
    encounter_start: '2026-08-01T08:00:00+03:00', encounter_end: '2026-08-01T10:00:00+03:00',
    service_date: '2026-08-01', practice_code: '08.00', pre_auth_ref: 'TEST-AUTH-REF',
    items: [{ sequence: 1, product_or_service_code: 'TEST-CODE', product_or_service_display: 'Test service',
      product_or_service_system: 'http://nphies.sa/terminology/CodeSystem/procedures',
      quantity: 1, unit_price: 100, net_amount: 100, factor: 1, currency: 'SAR', tax: 0,
      patient_share: 0, payer_share: 100, serviced_date: '2026-08-01', patient_invoice: 'TEST-INVOICE',
      tooth_number: '11', eye: 'right', days_supply: 5, medication_code: 'TEST-MEDICATION',
      item_type: 'medication', prescribed_medication_code: 'TEST-MEDICATION' }],
    diagnoses: [{ sequence: 1, diagnosis_code: 'Z00.0', diagnosis_type: 'principal', on_admission: true }],
    supporting_info: [{ sequence: 1, category: 'chief-complaint', value_string: 'Synthetic test only' }],
    attachments: [], vision_prescription: { product_type: 'lens', right_eye: { sphere: -1, cylinder: 0, axis: 0 } }
  };
  return { patient, provider, insurer, coverage, priorAuth: structuredClone(record), claim: structuredClone(record) };
}
