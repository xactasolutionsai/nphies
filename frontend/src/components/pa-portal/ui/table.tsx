import * as React from "react"
import { cn } from "@/lib/utils"

export const Table = ({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
	<table className={cn("w-full text-sm", className)} {...props} />
)
export const THead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead {...props} />
export const TBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody {...props} />
export const TR = (props: React.HTMLAttributes<HTMLTableRowElement>) => <tr className="border-b" {...props} />
export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
	<th className={cn("px-3 py-2 text-left font-medium", className)} {...props} />
)
export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
	<td className={cn("px-3 py-2", className)} {...props} />
)
