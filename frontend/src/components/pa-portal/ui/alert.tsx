import { cn } from "@/lib/utils"

export function Alert({ variant = "default", title, description, className }: { variant?: "default" | "success" | "error"; title?: string; description?: string; className?: string }) {
	const base = "rounded-md border p-4"
	const styles = {
		default: "border-border",
		success: "border-green-300 bg-green-50 text-green-900",
		error: "border-red-300 bg-red-50 text-red-900",
	}
	return (
		<div className={cn(base, styles[variant], className)} role="status" aria-live="polite">
			{title && <div className="font-medium">{title}</div>}
			{description && <div className="text-sm opacity-90">{description}</div>}
		</div>
	)
}
