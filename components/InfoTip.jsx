"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// An optional explanation behind a small icon: hover, keyboard focus or a tap shows it. Errors and
// things someone has to act on stay on the page instead.
export default function InfoTip({ label, children, side = "top", className }) {
	const [isOpen, setIsOpen] = useState(false);
	return (
		<Tooltip open={isOpen} onOpenChange={setIsOpen}>
			<TooltipTrigger asChild>
				<button
					type="button"
					aria-label={label}
					// Inside a field's <label>, a tap would otherwise focus the field instead.
					onClick={(event) => {
						event.preventDefault();
						setIsOpen((value) => !value);
					}}
					className={cn(
						"relative inline-grid size-4 shrink-0 place-items-center rounded-full text-muted-foreground/60 transition-colors duration-150 after:absolute after:-inset-2 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none",
						className
					)}
				>
					<Info className="size-3.5" />
				</button>
			</TooltipTrigger>
			<TooltipContent side={side} className="max-w-64 text-pretty">
				{children}
			</TooltipContent>
		</Tooltip>
	);
}
