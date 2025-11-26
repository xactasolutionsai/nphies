import { Control, Controller } from 'react-hook-form'
import { PriorAuthFormData } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function CoverageForm({ control }: { control: Control<PriorAuthFormData> }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			<div>
				<Label htmlFor="coverage.insurer" required>Insurance Company</Label>
				<Controller name="coverage.insurer" control={control} render={({ field }) => <Input id="coverage.insurer" placeholder="e.g. Bupa Arabia" {...field} required />} />
			</div>
			<div>
				<Label htmlFor="coverage.policyNumber" required>Policy Number</Label>
				<Controller name="coverage.policyNumber" control={control} render={({ field }) => <Input id="coverage.policyNumber" placeholder="e.g. PA-123456789" {...field} required />} />
			</div>
			<div>
				<Label htmlFor="coverage.eligibilityRef">Eligibility Ref</Label>
				<Controller name="coverage.eligibilityRef" control={control} render={({ field }) => <Input id="coverage.eligibilityRef" placeholder="e.g. ELIG-2025-000123" {...field} />} />
			</div>
		</div>
	)
}
