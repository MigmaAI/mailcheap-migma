import LogoMailcheap from "@/components/LogoMailcheap";
import LogoMigma from "@/components/LogoMigma";

// Mailcheap and Migma side by side, a dot carrying the newsletter from one to the other. Migma's mark is
// its brand-kit file at its own proportions; the line and dot use the theme's colors.
export default function IllustrationConnect() {
	return (
		<div aria-hidden="true" className="flex items-center justify-center gap-2">
			<Tile>
				<LogoMailcheap className="size-8" />
			</Tile>
			<svg viewBox="0 0 64 12" width="64" height="12" className="overflow-visible text-muted-foreground/45">
				<path d="M4 6h56" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="0.01 6" />
				<circle
					cx="4"
					cy="6"
					r="3"
					style={{ "--connect-distance": "56px" }}
					className="fill-foreground animate-connect"
				/>
			</svg>
			<Tile>
				<LogoMigma variant="mark" height={32} />
			</Tile>
		</div>
	);
}

function Tile({ children }) {
	return (
		<span className="grid size-14 place-items-center rounded-2xl bg-background shadow-border">
			{children}
		</span>
	);
}
