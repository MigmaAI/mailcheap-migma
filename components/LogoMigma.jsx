import { cn } from "@/lib/utils";

// Migma's mark: the envelope in a rounded square, in the theme's foreground color.
export default function LogoMigma({ className }) {
	return (
		<svg viewBox="0 0 400 400" aria-hidden="true" className={cn("size-4 shrink-0", className)}>
			<path
				d="M300 20H100C55.8 20 20 55.8 20 100V300C20 344.2 55.8 380 100 380H300C344.2 380 380 344.2 380 300V100C380 55.8 344.2 20 300 20Z"
				className="fill-foreground"
			/>
			<path
				d="M270.8 125.8C274.8 123.3 280 126.1 280 130.8V273.5C280 276.8 277.3 279.5 274 279.5H126C122.7 279.5 120 276.8 120 273.5V130.8C120 126.1 125.2 123.3 129.2 125.8L196.8 168.2C198.8 169.4 201.2 169.4 203.2 168.2L270.8 125.8Z"
				className="fill-background"
			/>
		</svg>
	);
}
