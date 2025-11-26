import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, ...props }, ref) => (
	<div ref={ref} className={cn("rounded-lg border bg-card text-card-foreground", className)} {...props} />
))
Card.displayName = "Card"

const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex flex-col space-y-1.5 p-8", className)} {...props} />
)

const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
	<h3 className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
)

const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
	<p className={cn("text-sm text-muted-foreground", className)} {...props} />
)

const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("p-8 pt-0", className)} {...props} />
)

const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div className={cn("flex items-center p-8 pt-0", className)} {...props} />
)

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
