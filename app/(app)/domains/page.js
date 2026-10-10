import { Suspense } from "react";
import { ChevronRight, ExternalLink, Globe, TriangleAlert } from "lucide-react";
import BadgeStatus from "@/components/BadgeStatus";
import ButtonCheckDomain from "@/components/ButtonCheckDomain";
import ButtonCopy from "@/components/ButtonCopy";
import DialogAddDomain from "@/components/DialogAddDomain";
import FormInstantDomain from "@/components/FormInstantDomain";
import HeaderPage from "@/components/HeaderPage";
import ImageFavicon from "@/components/ImageFavicon";
import SkeletonDomains from "@/components/SkeletonDomains";
import StateEmpty from "@/components/StateEmpty";
import { Button } from "@/components/ui/button";
import { requireMigma } from "@/lib/auth";
import { rootDomain } from "@/lib/favicon";
import { listSendingDomains } from "@/lib/migma";

export const metadata = { title: "Domains" };

// Sending domains live in Migma: it verifies them, signs mail (DKIM, return path) and watches their health.
export default async function DomainsPage() {
	const { migma } = await requireMigma();
	return (
		<>
			<HeaderPage title="Domains">
				<DialogAddDomain />
			</HeaderPage>
			<Suspense fallback={<SkeletonDomains />}>
				<ListDomains migma={migma} />
			</Suspense>
		</>
	);
}

async function ListDomains({ migma }) {
	let domains;
	try {
		domains = await listSendingDomains(migma);
	} catch (error) {
		return (
			<StateEmpty icon={TriangleAlert} title="Could not reach Migma">
				<p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
			</StateEmpty>
		);
	}
	const hasInstant = domains.some(({ managed }) => managed);

	return (
		<div className="flex flex-col gap-3">
			{domains.length === 0 && (
				<StateEmpty icon={Globe} title="No sending domain yet">
					<p className="max-w-md text-sm text-muted-foreground">
						Add your own domain to send to your whole list, or start with an instant domain below.
					</p>
				</StateEmpty>
			)}
			{domains.map((domain, index) => {
				const isPending = !domain.verified && !domain.managed && domain.status !== "suspended";
				return (
					<section
						key={domain.domain}
						style={{ "--stagger": index }}
						className="overflow-hidden rounded-xl bg-card shadow-border animate-enter"
					>
						<div className="flex flex-wrap items-center justify-between gap-3 p-4">
							<div className="flex min-w-0 items-center gap-3">
								<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
									<ImageFavicon domain={rootDomain(domain.domain)} size={20} />
								</div>
								<div className="min-w-0">
									<p className="truncate font-medium">{domain.domain}</p>
									{domain.managed && (
										<p className="text-xs text-muted-foreground">Instant domain · up to 50 recipients a day</p>
									)}
								</div>
							</div>
							<div className="flex flex-wrap items-center gap-2">
								{!domain.managed && domain.dkimStatus && <StatusPill label="DKIM" status={domain.dkimStatus} />}
								{!domain.managed && domain.mailFromDomain && <StatusPill label="Return path" status={domain.mailFromStatus} />}
								<BadgeStatus
									status={domain.verified ? "verified" : domain.status === "suspended" ? "failed" : "pending"}
									label={domain.verified ? "Verified" : domain.status === "suspended" ? "Suspended" : "Pending"}
								/>
							</div>
						</div>

						{isPending && (
							<div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3">
								<p className="text-sm text-pretty text-muted-foreground">
									Add these records where you manage {rootDomain(domain.domain)}&apos;s DNS. Migma verifies them on its own.
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
						)}

						{domain.records.length > 0 && (
							<details className="group border-t border-border/60" open={isPending}>
								<summary className="flex h-11 cursor-pointer list-none items-center gap-1.5 px-4 text-sm text-muted-foreground transition-colors duration-150 select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
									<ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" />
									DNS records
								</summary>
								<div className="overflow-x-auto border-t border-border/60">
									<table className="w-full text-sm">
										<tbody className="divide-y divide-border/60">
											{domain.records.map((record) => (
												<tr key={`${record.type}-${record.name}-${record.value}`}>
													<td className="w-16 py-2 pl-4 align-middle font-mono text-xs text-muted-foreground">
														{record.type}
													</td>
													<td className="max-w-0 py-2 pr-2 align-middle">
														<div className="flex items-center gap-1">
															<span className="truncate font-mono text-xs">{record.name}</span>
															<ButtonCopy value={record.name} label="Copy name" />
														</div>
													</td>
													<td className="max-w-0 py-2 pr-4 align-middle">
														<div className="flex items-center gap-1">
															<span className="truncate font-mono text-xs">{record.value}</span>
															<ButtonCopy value={record.value} label="Copy value" />
														</div>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</details>
						)}
					</section>
				);
			})}
			{!hasInstant && <FormInstantDomain />}
		</div>
	);
}

function StatusPill({ label, status }) {
	const key = String(status ?? "").toLowerCase();
	return (
		<BadgeStatus
			status={key}
			label={`${label} ${key === "success" ? "ok" : key.replaceAll("_", " ") || "missing"}`}
		/>
	);
}
