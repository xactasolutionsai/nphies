export type Gender = 'male' | 'female' | 'other' | 'unknown'
export type EncounterClass = 'inpatient' | 'outpatient' | 'daycase' | 'emergency' | 'telemedicine'
export type ServiceType = 'imaging' | 'surgery' | 'pharmacy' | 'referral' | 'transfer' | 'vision' | 'dental' | 'other'
export type RequestStatus = 'pending' | 'approved' | 'denied' | 'queued'

export interface PatientInfo {
	fullName: string
	idNumber: string
	dob: string
	gender: Gender
	contactPhone?: string
	email?: string
}

export interface ProviderInfo {
	facilityName: string
	doctorName: string
	licenseNumber: string
	department?: string
	contactPhone?: string
	email?: string
}

export interface CoverageInfo {
	insurer: string
	policyNumber: string
	eligibilityRef?: string
	coverageType?: string
}

export interface ServiceRequestBase {
	serviceType: ServiceType
	cptCodes?: string
	icd10Codes?: string
	description: string
	diagnosis?: string
	// Clinical justification split into structured parts
	previousTest?: string
	testResults?: string
	medicalPlan?: string
	startDate: string
	endDate?: string
	urgency: 'routine' | 'urgent' | 'emergency'
}

// Additional details per type
export type Laterality = 'left' | 'right' | 'bilateral'
export interface ImagingFields { bodyPart?: string; laterality?: Laterality; modality?: 'xray' | 'mri' | 'ct' | 'ultrasound' | 'mammography' | 'other' }
export interface SurgeryFields { plannedProcedure?: string; anesthesiaType?: string; estimatedLOS?: string }
export interface Medication {
	medication: string
	strength?: string
	dosage?: string
	route?: string
	daysSupply?: number
}

export interface PharmacyFields { medications?: Medication[] }
export interface ReferralFields { specialty?: string; referredProvider?: string; referralReason?: string }
export interface TransferFields { fromFacility?: string; toFacility?: string; transportType?: 'ambulance' | 'air' | 'other' }
export interface VisionDentalFields { procedureCodes?: string; prostheticsOrLenses?: string }

export type TypeSpecificFields = ImagingFields & SurgeryFields & PharmacyFields & ReferralFields & TransferFields & VisionDentalFields

export interface PriorAuthFormData {
	patient: PatientInfo
	provider: ProviderInfo
	coverage: CoverageInfo
	encounterClass: EncounterClass
	encounterStart?: string
	encounterEnd?: string
	service: ServiceRequestBase & Partial<TypeSpecificFields>
	attachments?: File[]
}

export interface HistoryRecord {
	id: string
	timestamp: number
	status: RequestStatus
	data: PriorAuthFormData
}
