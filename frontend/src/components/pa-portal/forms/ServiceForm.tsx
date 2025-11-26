import { Control, Controller, UseFormSetValue } from 'react-hook-form'
import { PriorAuthFormData, ServiceType, EncounterClass } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const presets: Record<ServiceType, string[]> = {
	imaging: [
		'X-Ray',
		'MRI',
		'CT',
		'Ultrasound',
		'Mammography',
	],
	surgery: ['Appendectomy', 'CABG Surgery', 'Cholecystectomy', 'Cataract Surgery'],
	pharmacy: ['Atorvastatin 20mg', 'Insulin glargine', 'Amoxicillin 500mg'],
	referral: ['Cardiology', 'Neurology', 'Orthopedics', 'Endocrinology'],
	transfer: ['ICU to Tertiary Center', 'Ward to Other Hospital'],
	vision: ['Lens Replacement'],
	dental: ['Root Canal', 'Crown Placement'],
	other: ['Physiotherapy Session', 'Rehabilitation Program'],
}

const bodyPartOptions: string[] = [
    'Head', 'Brain', 'Spine', 'Neck', 'Chest', 'Breast', 'Abdomen', 'Pelvis',
    'Knee', 'Shoulder', 'Hip', 'Hand', 'Foot', 'Sinuses', 'Orbit'
]


// CPT presets keyed by service type and description
const cptPresets: Partial<Record<ServiceType, Record<string, string[]>>> = {
    imaging: {
        'Chest X-Ray': ['71045', '71046'],
        'MRI Brain': ['70551', '70552'],
        'CT Abdomen': ['74150', '74160'],
        'Ultrasound Pelvis': ['76856', '76857'],
        'Mammography': ['77067']
    },
    surgery: {
        'Appendectomy': ['44950', '44970'],
        'Cholecystectomy': ['47562', '47563'],
        'Cataract Surgery': ['66984'],
        'CABG Surgery': ['33533', '33536']
    },
    vision: {
        'Lens Replacement': ['66984']
    },
    dental: {
        'Root Canal': ['D3310', 'D3320', 'D3330'],
        'Crown Placement': ['D2740']
    }
}

// ICD-10 presets keyed by service type and description
const icd10Presets: Partial<Record<ServiceType, Record<string, string[]>>> = {
    imaging: {
        'Chest X-Ray': ['J18.9', 'R05.9'],
        'MRI Brain': ['R51.9', 'G93.9'],
        'CT Abdomen': ['R10.9'],
        'Ultrasound Pelvis': ['R10.2'],
        'Mammography': ['Z12.31']
    },
    surgery: {
        'Appendectomy': ['K35.80'],
        'Cholecystectomy': ['K80.10'],
        'Cataract Surgery': ['H25.9'],
        'CABG Surgery': ['I25.10']
    },
    vision: {
        'Lens Replacement': ['H25.9']
    },
    dental: {
        'Root Canal': ['K04.01'],
        'Crown Placement': ['K02.9']
    }
}

export default function ServiceForm({ control, setValue }: { control: Control<PriorAuthFormData>; setValue: UseFormSetValue<PriorAuthFormData> }) {
	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
				<div>
					<Label htmlFor="encounterClass" required>Encounter</Label>
					<Controller name="encounterClass" control={control} render={({ field }) => (
						<Select id="encounterClass" {...field} required>
							<option value="">Select</option>
							{(['inpatient','outpatient','daycase','emergency','telemedicine'] as EncounterClass[]).map(v => (
								<option key={v} value={v}>{v}</option>
							))}
						</Select>
					)} />
				</div>
				<div>
					<Label htmlFor="service.serviceType" required>Service Type</Label>
                    <Controller name="service.serviceType" control={control} render={({ field }) => (
                        <Select id="service.serviceType" {...field} required onChange={(e) => {
                            field.onChange(e)
                            // Clear dependent fields when service type changes
                            setValue('service.description', '')
                            setValue('service.diagnosis', '')
                            setValue('service.cptCodes', '')
                            setValue('service.icd10Codes', '')
                        }}>
							<option value="">Select</option>
							{(['imaging','surgery','pharmacy','referral','transfer','vision','dental','other'] as ServiceType[]).map(v => (
								<option key={v} value={v}>{v}</option>
							))}
						</Select>
					)} />
				</div>
				<div>
					<Label htmlFor="service.startDate" required>Start Date</Label>
					<Controller name="service.startDate" control={control} render={({ field }) => <Input id="service.startDate" type="date" placeholder="YYYY-MM-DD" {...field} required />} />
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<Label htmlFor="service.description" required>Service Description</Label>
                    <Controller name="service.description" control={control} render={({ field }) => (
						<Controller name="service.serviceType" control={control} render={({ field: typeField }) => (
                            <Select id="service.description" {...field} required onChange={(e) => {
                                field.onChange(e)
                                // Reset codes when description changes
                                setValue('service.cptCodes', '')
                                setValue('service.icd10Codes', '')
                                // With modality-only descriptions, do not auto-set body part
                            }}>
								<option value="">Select a service...</option>
								{(presets[typeField.value as ServiceType] || []).map((p) => (
									<option key={p} value={p}>{p}</option>
								))}
								<option value="custom">Other (custom input)</option>
							</Select>
						)} />
					)} />
					<Controller name="service.description" control={control} render={({ field }) => 
						field.value === 'custom' ? (
							<Input 
								placeholder="e.g. MRI spine without contrast" 
								onChange={(e) => field.onChange(e.target.value)}
								className="mt-2"
							/>
						) : null
					} />
				</div>
				<div>
					<Label htmlFor="service.urgency" required>Urgency</Label>
					<Controller name="service.urgency" control={control} render={({ field }) => (
						<Select id="service.urgency" {...field} required>
							<option value="routine">Routine</option>
							<option value="urgent">Urgent</option>
							<option value="emergency">Emergency</option>
						</Select>
					)} />
				</div>
			<div>
				<Label htmlFor="service.cptCodes">CPT Codes</Label>
				<Controller name="service.cptCodes" control={control} render={({ field }) => (
					<Controller name="service.serviceType" control={control} render={({ field: typeField }) => (
						<Controller name="service.description" control={control} render={({ field: descField }) => {
							const options = cptPresets[typeField.value as ServiceType]?.[descField.value as string] || []
							return (
								<>
									<Select id="service.cptCodes" value={field.value || ''} onChange={(e) => field.onChange(e.target.value)}>
										<option value="">Select CPT… e.g. 70551</option>
										{options.map((code) => (
											<option key={code} value={code}>{code}</option>
										))}
										<option value="custom">Other (custom input)</option>
									</Select>
									{field.value === 'custom' ? (
										<Input 
											placeholder="e.g. 70551"
											className="mt-2"
											onChange={(e) => field.onChange(e.target.value)}
										/>
									) : null}
								</>
							)
						}} />
					)} />
				)} />
			</div>
			<div>
				<Label htmlFor="service.icd10Codes">ICD-10 Codes</Label>
				<Controller name="service.icd10Codes" control={control} render={({ field }) => (
					<Controller name="service.serviceType" control={control} render={({ field: typeField }) => (
						<Controller name="service.description" control={control} render={({ field: descField }) => {
							const options = icd10Presets[typeField.value as ServiceType]?.[descField.value as string] || []
							return (
								<>
									<Select id="service.icd10Codes" value={field.value || ''} onChange={(e) => field.onChange(e.target.value)}>
										<option value="">Select ICD-10… e.g. R51.9</option>
										{options.map((code) => (
											<option key={code} value={code}>{code}</option>
										))}
										<option value="custom">Other (custom input)</option>
									</Select>
									{field.value === 'custom' ? (
										<Input 
											placeholder="e.g. R51.9"
											className="mt-2"
											onChange={(e) => field.onChange(e.target.value)}
										/>
									) : null}
								</>
							)
						}} />
					)} />
				)} />
			</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<Label htmlFor="service.diagnosis">Diagnosis</Label>
					<Controller name="service.diagnosis" control={control} render={({ field }) => <Textarea id="service.diagnosis" placeholder="e.g. Acute appendicitis, Type 2 diabetes mellitus" {...field} />} />
				</div>
				<div>
					<Label htmlFor="service.previousTest">Previous Tests</Label>
					<Controller name="service.previousTest" control={control} render={({ field }) => <Textarea id="service.previousTest" placeholder="Prior imaging/labs/therapies and dates" {...field} />} />
				</div>
				<div>
					<Label htmlFor="service.testResults">Test Results</Label>
					<Controller name="service.testResults" control={control} render={({ field }) => <Textarea id="service.testResults" placeholder="Key findings, abnormal values, severity" {...field} />} />
				</div>
				<div>
					<Label htmlFor="service.medicalPlan">Medical Plan</Label>
					<Controller name="service.medicalPlan" control={control} render={({ field }) => <Textarea id="service.medicalPlan" placeholder="Planned management and rationale" {...field} />} />
				</div>
			</div>

			{/* Dynamic sections */}
			<Controller name="service.serviceType" control={control} render={({ field }) => {
				const t = field.value as ServiceType
				return (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {t === 'imaging' && (
                            <>
                                <div>
                                    <Label htmlFor="service.bodyPart">Body Part</Label>
                                    <Controller name="service.bodyPart" control={control} render={({ field }) => (
                                        <Select id="service.bodyPart" value={field.value || ''} onChange={(e) => field.onChange(e.target.value)}>
                                            <option value="">Select body part…</option>
                                            {bodyPartOptions.map((p) => (
                                                <option key={p} value={p}>{p}</option>
                                            ))}
                                        </Select>
                                    )} />
                                </div>
                                <div>
                                    <Label htmlFor="service.laterality">Side</Label>
                                    <Controller name="service.laterality" control={control} render={({ field }) => (
                                        <div className="flex gap-2">
                                            <Button type="button" variant={field.value === 'left' ? 'default' : 'outline'} onClick={() => field.onChange('left')}>Left</Button>
                                            <Button type="button" variant={field.value === 'right' ? 'default' : 'outline'} onClick={() => field.onChange('right')}>Right</Button>
                                            <Button type="button" variant={field.value === 'bilateral' ? 'default' : 'outline'} onClick={() => field.onChange('bilateral')}>Bilateral</Button>
                                        </div>
                                    )} />
                                </div>
                            </>
                        )}
						{t === 'surgery' && (
							<>
								<div>
									<Label htmlFor="service.plannedProcedure">Planned Procedure</Label>
									<Controller name="service.plannedProcedure" control={control} render={({ field }) => <Input id="service.plannedProcedure" placeholder="e.g. Laparoscopic cholecystectomy" {...field} />} />
								</div>
								<div>
									<Label htmlFor="service.anesthesiaType">Anesthesia Type</Label>
						<Controller name="service.anesthesiaType" control={control} render={({ field }) => (
							<Select id="service.anesthesiaType" {...field}>
								<option value="">Select type</option>
								<option value="general">General</option>
								<option value="regional">Regional</option>
								<option value="spinal">Spinal</option>
								<option value="epidural">Epidural</option>
								<option value="local">Local</option>
								<option value="sedation">Sedation</option>
								<option value="mac">Monitored Anesthesia Care (MAC)</option>
								<option value="other">Other</option>
							</Select>
						)} />
								</div>
								<div>
									<Label htmlFor="service.estimatedLOS">Est. Length of Stay</Label>
									<Controller name="service.estimatedLOS" control={control} render={({ field }) => <Input id="service.estimatedLOS" placeholder="e.g. 3 days" {...field} />} />
								</div>
							</>
						)}
						{t === 'pharmacy' && (
							<div className="col-span-full">
								<Controller name="service.medications" control={control} render={({ field }) => (
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<Label>Medications</Label>
											<Button 
												type="button" 
												variant="outline" 
												size="sm"
												onClick={() => field.onChange([...(field.value || []), { medication: '', strength: '', dosage: '', route: '', daysSupply: 1 }])}
											>
												+ Add Medication
											</Button>
										</div>
										{(field.value || []).map((med: any, index: number) => (
											<div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-4 border rounded-md">
												<div>
													<Label htmlFor={`medication-${index}`}>Medication</Label>
													<Input 
														id={`medication-${index}`}
														value={med.medication || ''} 
														onChange={(e) => {
															const newMeds = [...(field.value || [])]
															newMeds[index] = { ...med, medication: e.target.value }
															field.onChange(newMeds)
														}}
														placeholder="Medication name"
														required
													/>
												</div>
												<div>
													<Label htmlFor={`strength-${index}`}>Strength</Label>
													<Input 
														id={`strength-${index}`}
														value={med.strength || ''} 
														onChange={(e) => {
															const newMeds = [...(field.value || [])]
															newMeds[index] = { ...med, strength: e.target.value }
															field.onChange(newMeds)
														}}
														placeholder="e.g. 20mg"
													/>
												</div>
												<div>
													<Label htmlFor={`dosage-${index}`}>Dosage</Label>
													<Input 
														id={`dosage-${index}`}
														value={med.dosage || ''} 
														onChange={(e) => {
															const newMeds = [...(field.value || [])]
															newMeds[index] = { ...med, dosage: e.target.value }
															field.onChange(newMeds)
														}}
														placeholder="e.g. 1 tablet"
													/>
												</div>
												<div>
													<Label htmlFor={`route-${index}`}>Route</Label>
													<Input 
														id={`route-${index}`}
														value={med.route || ''} 
														onChange={(e) => {
															const newMeds = [...(field.value || [])]
															newMeds[index] = { ...med, route: e.target.value }
															field.onChange(newMeds)
														}}
														placeholder="e.g. oral"
													/>
												</div>
												<div className="flex items-end gap-2">
													<div className="flex-1">
														<Label htmlFor={`daysSupply-${index}`}>Days</Label>
														<Input 
															id={`daysSupply-${index}`}
															type="number" 
															min={1}
															value={med.daysSupply || 1} 
															onChange={(e) => {
																const newMeds = [...(field.value || [])]
																newMeds[index] = { ...med, daysSupply: parseInt(e.target.value) || 1 }
																field.onChange(newMeds)
															}}
														/>
													</div>
													<Button 
														type="button" 
														variant="destructive" 
														size="sm"
														onClick={() => {
															const newMeds = (field.value || []).filter((_: any, i: number) => i !== index)
															field.onChange(newMeds)
														}}
													>
														×
													</Button>
												</div>
											</div>
										))}
										{(!field.value || field.value.length === 0) && (
											<div className="text-center text-muted-foreground py-4">
												No medications added. Click "Add Medication" to start.
											</div>
										)}
									</div>
								)} />
							</div>
						)}
						{t === 'referral' && (
							<>
								<div>
									<Label htmlFor="service.specialty">Specialty</Label>
									<Controller name="service.specialty" control={control} render={({ field }) => <Input id="service.specialty" placeholder="e.g. Cardiology" {...field} />} />
								</div>
								<div>
									<Label htmlFor="service.referredProvider">Referred Provider</Label>
									<Controller name="service.referredProvider" control={control} render={({ field }) => <Input id="service.referredProvider" placeholder="e.g. Dr. Mohammed Ali" {...field} />} />
								</div>
								<div>
									<Label htmlFor="service.referralReason">Referral Reason</Label>
									<Controller name="service.referralReason" control={control} render={({ field }) => <Input id="service.referralReason" placeholder="e.g. evaluation of chest pain" {...field} />} />
								</div>
							</>
						)}
						{t === 'transfer' && (
							<>
								<div>
									<Label htmlFor="service.fromFacility">From Facility</Label>
									<Controller name="service.fromFacility" control={control} render={({ field }) => <Input id="service.fromFacility" placeholder="e.g. City Hospital" {...field} />} />
								</div>
								<div>
									<Label htmlFor="service.toFacility">To Facility</Label>
									<Controller name="service.toFacility" control={control} render={({ field }) => <Input id="service.toFacility" placeholder="e.g. Tertiary Care Center" {...field} />} />
								</div>
								<div>
									<Label htmlFor="service.transportType">Transport Type</Label>
									<Controller name="service.transportType" control={control} render={({ field }) => <Input id="service.transportType" placeholder="e.g. ambulance or air" {...field} />} />
								</div>
							</>
						)}
					{(t === 'vision' || t === 'dental') && (
							<>
								<div>
								<Label htmlFor="service.procedureCodes">{t === 'dental' ? 'Dental Procedure Codes (CDT)' : 'Procedure Codes'}</Label>
									<Controller name="service.procedureCodes" control={control} render={({ field }) => <Input id="service.procedureCodes" placeholder={t === 'dental' ? 'e.g. D2740' : 'e.g. 66984'} {...field} />} />
								</div>
								<div>
								<Label htmlFor="service.prostheticsOrLenses">{t === 'dental' ? 'Prosthetics/Appliances' : 'Prosthetics/Lenses'}</Label>
									<Controller name="service.prostheticsOrLenses" control={control} render={({ field }) => <Input id="service.prostheticsOrLenses" placeholder={t === 'dental' ? 'e.g. partial denture, crown, splint' : 'e.g. single vision lenses, frames'} {...field} />} />
								</div>
							</>
						)}
					</div>
				)
			}} />
		</div>
	)
}
