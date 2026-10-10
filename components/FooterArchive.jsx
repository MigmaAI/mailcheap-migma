import AvatarNewsletter from "@/components/AvatarNewsletter";
import LinksSocial from "@/components/LinksSocial";
import LogoMigma from "@/components/LogoMigma";
import { MIGMA_APP_URL } from "@/lib/config";
import { currentYear } from "@/lib/format";

export default function FooterArchive({ newsletter, indexHref }) {
	return (
		<footer className="border-t border-border/60">
			<div className="mx-auto grid max-w-5xl gap-6 px-5 pt-10 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
				<div className="flex flex-col gap-3">
					<a href={indexHref} className="flex items-center gap-2.5 font-medium tracking-tight">
						<AvatarNewsletter newsletter={newsletter} size={28} />
						{newsletter.name}
					</a>
					{newsletter.description && (
						<p className="max-w-sm text-sm text-muted-foreground text-pretty">{newsletter.description}</p>
					)}
				</div>
				<LinksSocial links={newsletter.socialLinks} className="-ml-2.5 sm:-mr-2.5 sm:ml-0" />
			</div>
			<div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 pb-10 text-xs text-muted-foreground">
				<p className="tabular-nums">
					© {currentYear()} {newsletter.name}
				</p>
				<a
					href={MIGMA_APP_URL}
					target="_blank"
					rel="noreferrer"
					aria-label="Sent with Mailcheap, powered by Migma"
					className="inline-flex items-center gap-2 py-1 transition-opacity duration-150 hover:opacity-80"
				>
					<span aria-hidden="true">Sent with Mailcheap, powered by</span>
					<LogoMigma height={14} />
				</a>
			</div>
		</footer>
	);
}
