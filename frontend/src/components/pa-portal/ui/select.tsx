import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, children, ...props }, ref) => (
	<select
		ref={ref}
		className={cn(
			"h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
			"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			className
		)}
		{...props}
	>
		{children}
	</select>
))
Select.displayName = "Select"
