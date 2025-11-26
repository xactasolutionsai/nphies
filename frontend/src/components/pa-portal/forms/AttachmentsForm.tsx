import { Control, Controller } from 'react-hook-form'
import { PriorAuthFormData } from '@/types'
import { Label } from '@/components/ui/label'

export default function AttachmentsForm({ control }: { control: Control<PriorAuthFormData> }) {
	return (
		<div className="space-y-2">
			<Label htmlFor="attachments">Attachments</Label>
			<Controller
				name="attachments"
				control={control}
				render={({ field }) => (
					<input
						id="attachments"
						type="file"
						multiple
						onChange={(e) => field.onChange(Array.from(e.target.files || []))}
						aria-description="Add PDFs, images, lab results, referrals"
					/>
				)}
			/>
		</div>
	)
}
