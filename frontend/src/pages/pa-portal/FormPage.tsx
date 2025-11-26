import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { JsonDisplayHighlighted } from '@/components/ui/json-display'
import { AIResponseDisplay } from '@/components/ui/ai-response-display'
import PatientForm from '@/components/forms/PatientForm'
import ProviderForm from '@/components/forms/ProviderForm'
import CoverageForm from '@/components/forms/CoverageForm'
import ServiceForm from '@/components/forms/ServiceForm'
import AttachmentsForm from '@/components/forms/AttachmentsForm'
import { PriorAuthFormData, ServiceType, HistoryRecord } from '@/types'
import { buildPriorAuthBundle } from '@/fhir/buildPriorAuth'
import { addHistory } from '@/services/storage'
import { sendPriorAuth } from '@/services/api'
import { Alert } from '@/components/ui/alert'

const baseSchema = z.object({
	patient: z.object({
		fullName: z.string().min(1),
		idNumber: z.string().min(1),
		dob: z.string().min(1),
		gender: z.enum(['male','female','other','unknown']),
		contactPhone: z.string().optional(),
		email: z.string().email().optional(),
	}),
	provider: z.object({
		facilityName: z.string().min(1),
		doctorName: z.string().min(1),
		licenseNumber: z.string().min(1),
		department: z.string().optional(),
		contactPhone: z.string().optional(),
		email: z.string().email().optional(),
	}),
	coverage: z.object({
		insurer: z.string().min(1),
		policyNumber: z.string().min(1),
		eligibilityRef: z.string().optional(),
		coverageType: z.string().optional(),
	}),
	encounterClass: z.enum(['inpatient','outpatient','daycase','emergency','telemedicine']),
	encounterStart: z.string().optional(),
	encounterEnd: z.string().optional(),
	service: z.object({
		serviceType: z.enum(['imaging','surgery','pharmacy','referral','transfer','vision','dental','other']),
		cptCodes: z.string().optional(),
		icd10Codes: z.string().optional(),
		description: z.string().min(1),
		diagnosis: z.string().optional(),
			previousTest: z.string().optional(),
			testResults: z.string().optional(),
			medicalPlan: z.string().optional(),
		startDate: z.string().min(1),
		endDate: z.never().optional().transform(() => undefined as any).optional(),
		urgency: z.enum(['routine','urgent','emergency']).default('routine'),
		// dynamic extras
		bodyPart: z.string().optional(),
		laterality: z.enum(['left','right','bilateral']).optional(),
		plannedProcedure: z.string().optional(),
		anesthesiaType: z.string().optional(),
		estimatedLOS: z.string().optional(),
		medications: z.array(z.object({
			medication: z.string().min(1),
			strength: z.string().optional(),
			dosage: z.string().optional(),
			route: z.string().optional(),
			daysSupply: z.coerce.number().min(1).optional(),
		})).optional(),
		specialty: z.string().optional(),
		referredProvider: z.string().optional(),
		referralReason: z.string().optional(),
		fromFacility: z.string().optional(),
		toFacility: z.string().optional(),
		transportType: z.string().optional(),
		procedureCodes: z.string().optional(),
		prostheticsOrLenses: z.string().optional(),
	}),
	attachments: z.any().array().optional(),
})

type Schema = z.infer<typeof baseSchema>

export default function FormPage({ serviceType, title }: { serviceType: ServiceType; title: string }) {
	const schema = useMemo(() => baseSchema, [])
	const [preview, setPreview] = useState<any | null>(null)
	const [status, setStatus] = useState<{ type: 'idle' | 'success' | 'error'; message?: string }>({ type: 'idle' })
	const [lastResponse, setLastResponse] = useState<any | null>(null)

	const form = useForm<Schema>({
		resolver: zodResolver(schema),
		defaultValues: {
			patient: { fullName: '', idNumber: '', dob: '', gender: 'male' },
			provider: { facilityName: '', doctorName: '', licenseNumber: '' },
			coverage: { insurer: '', policyNumber: '' },
			encounterClass: 'outpatient',
			service: { serviceType, description: '', startDate: '', urgency: 'routine' },
			attachments: [],
		},
	})

	async function onSubmit(values: Schema) {
		const data = values as unknown as PriorAuthFormData
		const bundle = buildPriorAuthBundle({
			...data,
		})
		setPreview(bundle)
		const record: HistoryRecord = { id: crypto.randomUUID(), timestamp: Date.now(), status: 'pending', data }
		addHistory(record)
	}

	async function onSend() {
		if (!preview) return
		try {
			const res = await sendPriorAuth(preview)
			setLastResponse(res)
			setStatus({ type: 'success', message: 'Sent to backend successfully.' })
		} catch (e: any) {
			setStatus({ type: 'error', message: e?.message || 'Failed to send' })
		}
	}

	async function onSendN8N() {
		if (!preview) return
		try {
			let u = typeof window !== 'undefined' ? window.localStorage.getItem('webhookUrl') || '' : ''
			if (!u) {
				// Ask user for the webhook URL once and store it
				// Note: simple prompt avoids needing a settings screen
				const input = typeof window !== 'undefined' ? window.prompt('Enter n8n Webhook URL', 'http://localhost:5678/webhook-test/check') : ''
				if (input && input.trim().length > 0) {
					window.localStorage.setItem('webhookUrl', input.trim())
					u = input.trim()
				} else {
					setStatus({ type: 'error', message: 'No webhook URL provided.' })
					return
				}
			}
			const res = await sendPriorAuth(preview, u)
			setLastResponse(res)
			setStatus({ type: 'success', message: 'Sent to n8n webhook successfully.' })
		} catch (e: any) {
			setStatus({ type: 'error', message: e?.message || 'Failed to send to n8n' })
		}
	}

	function onDownload() {
		if (!preview) return
		const blob = new Blob([JSON.stringify(preview, null, 2)], { type: 'application/json' })
		const link = document.createElement('a')
		link.href = URL.createObjectURL(blob)
		link.download = `${serviceType}-prior-auth.json`
		link.click()
		URL.revokeObjectURL(link.href)
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">{title}</h1>
				<div className="flex gap-2">
					<Button type="button" onClick={() => form.handleSubmit(onSubmit)()}>Preview JSON</Button>
					<Button type="button" variant="secondary" onClick={onSendN8N} disabled={!preview}>Send to n8n</Button>
					<Button type="button" variant="secondary" onClick={onSend} disabled={!preview}>Send to Backend</Button>
					<Button type="button" variant="outline" onClick={onDownload} disabled={!preview}>Download JSON</Button>
				</div>
			</div>

			{status.type === 'success' && <Alert variant="success" title="Success" description={status.message} />} 
			{status.type === 'error' && <Alert variant="error" title="Error" description={status.message} />}

			{lastResponse && (
				<AIResponseDisplay 
					data={lastResponse?.output || lastResponse} 
					title="AI Response"
					className="mt-6"
				/>
			)}

			<form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
				<Card>
					<CardHeader><CardTitle>Patient Information</CardTitle></CardHeader>
					<CardContent><PatientForm control={form.control} /></CardContent>
				</Card>
				<Card>
					<CardHeader><CardTitle>Provider Information</CardTitle></CardHeader>
					<CardContent><ProviderForm control={form.control} /></CardContent>
				</Card>
				<Card>
					<CardHeader><CardTitle>Coverage Information</CardTitle></CardHeader>
					<CardContent><CoverageForm control={form.control} /></CardContent>
				</Card>
				<Card>
					<CardHeader><CardTitle>Encounter & Service</CardTitle></CardHeader>
					<CardContent><ServiceForm control={form.control} setValue={form.setValue} /></CardContent>
				</Card>
				<Card>
					<CardHeader><CardTitle>Attachments</CardTitle></CardHeader>
					<CardContent><AttachmentsForm control={form.control} /></CardContent>
				</Card>
				<div>
					<Button type="submit">Generate Preview</Button>
				</div>
			</form>

			{preview && (
				<JsonDisplayHighlighted 
					data={preview} 
					title="FHIR Bundle Preview"
					className="mt-6"
				/>
			)}
		</div>
	)
}
