import { PriorAuthFormData } from "@/types"

export function buildPriorAuthBundle(data: PriorAuthFormData) {
	const patientId = `patient-${crypto.randomUUID()}`
	const coverageId = `coverage-${crypto.randomUUID()}`
	const practitionerId = `practitioner-${crypto.randomUUID()}`
	const orgId = `org-${crypto.randomUUID()}`
	const claimId = `claim-${crypto.randomUUID()}`

	return {
		resourceType: 'Bundle',
		type: 'collection',
		entry: [
			{
				resource: {
					resourceType: 'Patient',
					id: patientId,
					name: [{ text: data.patient.fullName }],
					telecom: [
						data.patient.contactPhone ? { system: 'phone', value: data.patient.contactPhone } : undefined,
						data.patient.email ? { system: 'email', value: data.patient.email } : undefined,
					].filter(Boolean),
					gender: data.patient.gender,
					birthDate: data.patient.dob,
					identifier: [{ system: 'urn:id:iqama-or-national', value: data.patient.idNumber }],
				},
			},
			{
				resource: {
					resourceType: 'Organization',
					id: orgId,
					name: data.provider.facilityName,
					telecom: [
						data.provider.contactPhone ? { system: 'phone', value: data.provider.contactPhone } : undefined,
						data.provider.email ? { system: 'email', value: data.provider.email } : undefined,
					].filter(Boolean),
				},
			},
			{
				resource: {
					resourceType: 'Practitioner',
					id: practitionerId,
					name: [{ text: data.provider.doctorName }],
					identifier: [{ system: 'urn:id:license', value: data.provider.licenseNumber }],
				},
			},
			{
				resource: {
					resourceType: 'Coverage',
					id: coverageId,
					status: 'active',
					payor: [{ display: data.coverage.insurer }],
					identifier: [{ system: 'urn:id:policy', value: data.coverage.policyNumber }],
					extension: data.coverage.eligibilityRef ? [{ url: 'urn:eligibility-ref', valueString: data.coverage.eligibilityRef }] : undefined,
				},
			},
			{
				resource: {
					resourceType: 'Claim',
					id: claimId,
					status: 'active',
					type: { coding: [{ system: 'urn:auth-type', code: data.service.serviceType }] },
					use: 'preauthorization',
					patient: { reference: `Patient/${patientId}` },
					provider: { reference: `Organization/${orgId}` },
					priority: { coding: [{ code: data.service.urgency || 'routine' }] },
					diagnosis: data.service.icd10Codes
						? data.service.icd10Codes.split(',').map((code) => ({ diagnosisCodeableConcept: { coding: [{ system: 'ICD-10', code: code.trim() }] } }))
						: undefined,
					procedure: data.service.cptCodes
						? data.service.cptCodes.split(',').map((code) => ({ procedureCodeableConcept: { coding: [{ system: 'CPT', code: code.trim() }] } }))
						: undefined,
					item: (data.service as any).medications?.map((med: any, index: number) => ({
						sequence: index + 1,
						productOrService: { text: med.medication },
						extension: [
							med.strength ? { url: 'strength', valueString: med.strength } : undefined,
							med.dosage ? { url: 'dosage', valueString: med.dosage } : undefined,
							med.route ? { url: 'route', valueString: med.route } : undefined,
							med.daysSupply ? { url: 'daysSupply', valueQuantity: { value: med.daysSupply, unit: 'days' } } : undefined,
						].filter(Boolean),
					})) || undefined,
					supportingInfo: [
						data.service.description ? { category: { text: 'description' }, valueString: data.service.description } : undefined,
						data.service.diagnosis ? { category: { text: 'diagnosis' }, valueString: data.service.diagnosis } : undefined,
						(data.service as any).bodyPart ? { category: { text: 'bodyPart' }, valueString: (data.service as any).bodyPart } : undefined,
						(data.service as any).laterality ? { category: { text: 'laterality' }, valueString: (data.service as any).laterality } : undefined,
						data.service.previousTest ? { category: { text: 'previousTest' }, valueString: data.service.previousTest } : undefined,
						data.service.testResults ? { category: { text: 'testResults' }, valueString: data.service.testResults } : undefined,
						data.service.medicalPlan ? { category: { text: 'medicalPlan' }, valueString: data.service.medicalPlan } : undefined,
					].filter(Boolean),
					billablePeriod: { start: data.service.startDate },
				},
			},
		],
	}
}
