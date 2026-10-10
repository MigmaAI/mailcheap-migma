import { ChevronRight, ExternalLink } from "lucide-react";
import BadgeStatus from "@/components/BadgeStatus";
import ButtonCheckDomain from "@/components/ButtonCheckDomain";
import ImageFavicon from "@/components/ImageFavicon";
import TableDnsRecords from "@/components/TableDnsRecords";
import { Button } from "@/components/ui/button";
import { rootDomain } from "@/lib/favicon";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const HEALTH_LABELS = { healthy: "Healthy", warning: "Watch it", critical: "At risk" };
const BADGES = {
	ready: { status: "verified", label: "Verified" },
	dns: { status: "pending", label: "Waiting for DNS" },
	failed: { status: "failed", label: "Not verified" },
	suspended: { status: "failed", label: "Suspended" },
};

function percent(value) {
	return value === null || value === undefined ? "–" : `${value.toFixed(value < 1 ? 2 : 1)}%`;
}

function subtitle(domain) {
	if (domain.state === "suspended") return domain.suspensionReason || "Migma paused sending for bounces or complaints";
	if (domain.state !== "ready") {
		return domain.checkedAt ? `Checked ${formatRelative(domain.checkedAt)}` : "Not checked yet";
	}
	return [
		domain.managed ? "Instant domain, up to 50 recipients a day" : domain.region && `Sends from ${domain.region}`,
		domain.verifiedAt && !domain.managed && `verified ${formatDate(domain.verifiedAt)}`,
	]
		.filter(Boolean)
		.join(" · ");
}

// One sending domain as Migma reports it: health once it sends, the missing records until then.
export default function CardDomain({ domain, stagger = 0 }) {
	const isWaiting = domain.state === "dns" || domain.state === "failed";
	const badge = BADGES[domain.state];
	return (
		<section style={{ "--stagger": stagger }} className="overflow-hidden rounded-xl bg-card shadow-border animate-enter">
			<div className="flex flex-wrap items-center justify-between gap-3 p-4">
				<div className="flex min-w-0 items-center gap-3">
					<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
						<ImageFavicon domain={rootDomain(domain.domain)} size={20} />
					</div>
					<div className="min-w-0">
						<p className="truncate font-medium">{domain.domain}</p>
						<p className="truncate text-xs text-muted-foreground">{subtitle(domain)}</p>
					</div>
				</div>
				<BadgeStatus status={badge.status} label={badge.label} />
			</div>

			{domain.state === "ready" && <ListDomainHealth domain={domain} />}

			{isWaiting && (
				<div className="flex flex-col gap-3 border-t border-border/60 px-4 py-3">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<p className="text-sm text-pretty text-muted-foreground">
							Add these records where you manage {rootDomain(domain.domain)}&apos;s DNS. Migma checks them on its own.
						</p>
						<div className="flex shrink-0 items-center gap-2">
							{domain.connectUrl && (
								<Button asChild size="sm" variant="outline">
									<a href={domain.connectUrl} target="_blank" rel="noreferrer">
										Set up DNS for me
										<ExternalLink data-icon="inline-end" className="opacity-60" />
									</a>
								</Button>
							)}
							<ButtonCheckDomain domain={domain.domain} />
						</div>
					</div>
					{domain.issues.length > 0 && (
						<ul className="flex flex-col gap-1 text-sm">
							{domain.issues.slice(0, 3).map((issue) => (
								<li key={issue} className="flex gap-2 text-pretty">
									<span aria-hidden="true" className="mt-2 size-1 shrink-0 rounded-full bg-amber-500" />
									{issue}
								</li>
							))}
						</ul>
					)}
				</div>
			)}

			{domain.records.length > 0 && (
				<details className="group border-t border-border/60" open={isWaiting}>
					<summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 px-4 text-sm text-muted-foreground transition-colors duration-150 select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
						<ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" />
						DNS records
						<span className="text-xs opacity-70 tabular-nums">
							{domain.records.filter(({ status }) => status === "verified").length}/{domain.records.length} found
						</span>
					</summary>
					<div className="border-t border-border/60">
						<TableDnsRecords records={domain.records} />
					</div>
				</details>
			)}
		</section>
	);
}

// What Migma measured for a domain that sends: volume, bounces, complaints, and what it tracks.
function ListDomainHealth({ domain }) {
	const { health, tracking } = domain;
	// A handful of sends makes any rate look extreme; Migma doesn't judge them until it has enough.
	const isEarly = !health || health.sent < health.minVolume;
	const items = [
		{
			label: "Health",
			value: !health?.sent ? "No sends yet" : isEarly ? "Too few sends to judge" : (HEALTH_LABELS[health.status] ?? health.status),
			tone: isEarly ? null : health?.status,
		},
		{ label: "Sent", value: health ? formatNumber(health.sent) : "–" },
		{ label: "Bounces", value: percent(health?.bounceRate), isMuted: isEarly },
		{ label: "Complaints", value: percent(health?.complaintRate), isMuted: isEarly },
		{
			label: "Tracking",
			value: tracking.opens && tracking.clicks ? "Opens, clicks" : tracking.opens ? "Opens" : tracking.clicks ? "Clicks" : "Off",
		},
	];
	return (
		<dl className="grid grid-cols-2 gap-px border-t border-border/60 bg-border/60 sm:grid-cols-5">
			{items.map(({ label, value, tone, isMuted }) => (
				<div key={label} className="flex flex-col gap-0.5 bg-card px-4 py-2.5">
					<dt className="text-xs text-muted-foreground">{label}</dt>
					<dd
						className={cn(
							"text-sm font-medium tabular-nums",
							isMuted && "font-normal text-muted-foreground",
							tone === "warning" && "text-amber-600 dark:text-amber-400",
							tone === "critical" && "text-red-600 dark:text-red-400"
						)}
					>
						{value}
					</dd>
				</div>
			))}
		</dl>
	);
}
