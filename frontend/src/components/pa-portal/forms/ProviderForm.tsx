import { Control, Controller } from 'react-hook-form'
import { PriorAuthFormData } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function ProviderForm({ control }: { control: Control<PriorAuthFormData> }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<Label htmlFor="provider.facilityName" required>Facility</Label>
				<Controller name="provider.facilityName" control={control} render={({ field }) => <Input id="provider.facilityName" placeholder="e.g. King Faisal Hospital" {...field} required />} />
			</div>
			<div>
				<Label htmlFor="provider.doctorName" required>Doctor</Label>
				<Controller name="provider.doctorName" control={control} render={({ field }) => <Input id="provider.doctorName" placeholder="e.g. Dr. Sara Al-Shehri" {...field} required />} />
			</div>
			<div>
				<Label htmlFor="provider.licenseNumber" required>License/NPI</Label>
				<Controller name="provider.licenseNumber" control={control} render={({ field }) => <Input id="provider.licenseNumber" placeholder="e.g. 12-345678" {...field} required />} />
			</div>
			<div>
				<Label htmlFor="provider.contactPhone">Phone</Label>
				<Controller name="provider.contactPhone" control={control} render={({ field }) => <Input id="provider.contactPhone" placeholder="e.g. +966511223344" {...field} />} />
			</div>
			<div>
				<Label htmlFor="provider.email">Email</Label>
				<Controller name="provider.email" control={control} render={({ field }) => <Input id="provider.email" type="email" placeholder="e.g. referral@kfh.sa" {...field} />} />
			</div>
		</div>
	)
}
