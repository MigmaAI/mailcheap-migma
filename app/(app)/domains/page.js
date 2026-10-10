import { Suspense } from "react";
import { ChevronRight, ExternalLink, Globe, TriangleAlert } from "lucide-react";
import ButtonCheckDomain from "@/components/ButtonCheckDomain";
import CardDomain from "@/components/CardDomain";
import DialogAddDomain from "@/components/DialogAddDomain";
import FormInstantDomain from "@/components/FormInstantDomain";
import HeaderPage from "@/components/HeaderPage";
import ImageFavicon from "@/components/ImageFavicon";
import SkeletonDomains from "@/components/SkeletonDomains";
import StateEmpty from "@/components/StateEmpty";
import { Button } from "@/components/ui/button";
import { requireMigma } from "@/lib/auth";
import { rootDomain } from "@/lib/favicon";
import { formatNumber } from "@/lib/format";
import { listSendingDomains } from "@/lib/migma";
import { groupDomains } from "@/lib/sending-domains";

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
	const groups = groupDomains(domains);
	const hasInstant = domains.some(({ managed }) => managed);

	if (domains.length === 0) {
		return (
			<div className="flex flex-col gap-3">
				<StateEmpty icon={Globe} title="No sending domain yet">
					<p className="max-w-md text-sm text-muted-foreground">
						Add your own domain to send to your whole list, or start with an instant domain below.
					</p>
				</StateEmpty>
				<FormInstantDomain />
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-8">
			<Group title="Ready to send" domains={groups.ready} />
			<Group title="Waiting for DNS" domains={groups.dns} />
			<Group title="Suspended" domains={groups.suspended} />
			{groups.failed.length > 0 && <ListFailed domains={groups.failed} />}
			{!hasInstant && <FormInstantDomain />}
		</div>
	);
}

function Group({ title, domains }) {
	if (domains.length === 0) return null;
	return (
		<section className="flex flex-col gap-3">
			<h2 className="text-sm font-medium text-muted-foreground">
				{title} <span className="tabular-nums opacity-70">{formatNumber(domains.length)}</span>
			</h2>
			{domains.map((domain, index) => (
				<CardDomain key={domain.domain} domain={domain} stagger={index} />
			))}
		</section>
	);
}

// Domains Migma stopped checking: one line each, folded away, with what Migma found.
function ListFailed({ domains }) {
	return (
		<details className="group rounded-xl bg-card shadow-border">
			<summary className="flex h-12 cursor-pointer list-none items-center gap-1.5 px-4 text-sm text-muted-foreground transition-colors duration-150 select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
				<ChevronRight className="size-4 transition-transform duration-200 group-open:rotate-90" />
				{formatNumber(domains.length)} {domains.length === 1 ? "domain" : "domains"} didn&apos;t verify
			</summary>
			<ul className="divide-y divide-border/60 border-t border-border/60">
				{domains.map((domain) => (
					<li key={domain.domain} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
						<div className="flex min-w-0 items-center gap-3">
							<ImageFavicon domain={rootDomain(domain.domain)} size={16} />
							<div className="min-w-0">
								<p className="truncate text-sm font-medium">{domain.domain}</p>
								<p className="truncate text-xs text-muted-foreground">
									{domain.issues[0] ??
										`${domain.records.filter(({ status }) => status === "verified").length} of ${domain.records.length} DNS records found`}
								</p>
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-2">
							{domain.connectUrl && (
								<Button asChild size="sm" variant="ghost">
									<a href={domain.connectUrl} target="_blank" rel="noreferrer">
										Set up DNS
										<ExternalLink data-icon="inline-end" className="opacity-60" />
									</a>
								</Button>
							)}
							<ButtonCheckDomain domain={domain.domain} />
						</div>
					</li>
				))}
			</ul>
		</details>
	);
}
