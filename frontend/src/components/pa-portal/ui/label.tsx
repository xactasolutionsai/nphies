import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cn } from "@/lib/utils"

type LabelProps = React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }

const Label = React.forwardRef<
    React.ElementRef<typeof LabelPrimitive.Root>,
    LabelProps
>(({ className, children, required, ...props }, ref) => (
    <LabelPrimitive.Root
        ref={ref}
        className={cn(
            "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
            className
        )}
        {...props}
    >
        <span>{children}</span>
        {required ? <span className="text-red-600 ml-0.5">*</span> : null}
    </LabelPrimitive.Root>
))
Label.displayName = LabelPrimitive.Root.displayName

export { Label }
