import LogoMigma from "@/components/LogoMigma";
import { MIGMA_APP_URL } from "@/lib/config";
import { cn } from "@/lib/utils";

const MARC_URL = "https://x.com/marclou";
const MAILCHEAP_URL = "https://github.com/marclou/mailcheap";
const MARC_AVATAR = "https://github.com/marclou.png?size=64";

// Mailcheap is Marc Lou's open-source newsletter app; this version sends through Migma.
export default function CreditsMailcheap({ className }) {
	return (
		<div className={cn("flex flex-col gap-1.5 text-xs text-muted-foreground", className)}>
			<a
				href={MIGMA_APP_URL}
				target="_blank"
				rel="noreferrer"
				className="inline-flex w-fit items-center gap-1.5 transition-colors duration-150 hover:text-foreground"
			>
				Powered by
				<LogoMigma className="size-3.5" />
				<span className="font-medium text-foreground">Migma</span>
			</a>
			<span className="inline-flex flex-wrap items-center gap-1">
				<a href={MAILCHEAP_URL} target="_blank" rel="noreferrer" className="transition-colors duration-150 hover:text-foreground">
					Mailcheap
				</a>
				by
				<a
					href={MARC_URL}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-1 font-medium text-foreground transition-opacity duration-150 hover:opacity-80"
				>
					{/* eslint-disable-next-line @next/next/no-img-element -- a 16px avatar from GitHub */}
					<img src={MARC_AVATAR} alt="" width={16} height={16} className="size-4 rounded-full bg-muted" />
					Marc Lou
				</a>
			</span>
		</div>
	);
}
