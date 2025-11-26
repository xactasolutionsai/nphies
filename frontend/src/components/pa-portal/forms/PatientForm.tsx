import { Control, Controller } from 'react-hook-form'
import { PriorAuthFormData } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'

export default function PatientForm({ control }: { control: Control<PriorAuthFormData> }) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
			<div>
				<Label htmlFor="patient.fullName" required>Full Name</Label>
				<Controller name="patient.fullName" control={control} render={({ field }) => <Input id="patient.fullName" placeholder="e.g. Ahmed Al-Qahtani" {...field} required />} />
			</div>
			<div>
				<Label htmlFor="patient.idNumber" required>ID/Iqama</Label>
				<Controller name="patient.idNumber" control={control} render={({ field }) => <Input id="patient.idNumber" placeholder="e.g. 1023456789" {...field} required />} />
			</div>
			<div>
				<Label htmlFor="patient.dob" required>Date of Birth</Label>
				<Controller name="patient.dob" control={control} render={({ field }) => <Input id="patient.dob" type="date" placeholder="YYYY-MM-DD" {...field} required />} />
			</div>
			<div>
				<Label htmlFor="patient.gender" required>Gender</Label>
				<Controller name="patient.gender" control={control} render={({ field }) => (
					<Select id="patient.gender" {...field} required>
						<option value="">Select gender…</option>
						<option value="male">Male</option>
						<option value="female">Female</option>
						<option value="other">Other</option>
						<option value="unknown">Unknown</option>
					</Select>
				)} />
			</div>
			<div>
				<Label htmlFor="patient.contactPhone">Phone</Label>
				<Controller name="patient.contactPhone" control={control} render={({ field }) => <Input id="patient.contactPhone" placeholder="e.g. +966512345678" {...field} />} />
			</div>
			<div>
				<Label htmlFor="patient.email">Email</Label>
				<Controller name="patient.email" control={control} render={({ field }) => <Input id="patient.email" type="email" placeholder="e.g. ahmed@example.com" {...field} />} />
			</div>
		</div>
	)
}
