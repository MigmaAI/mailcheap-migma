import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Globe, Newspaper, Settings2, TriangleAlert } from "lucide-react";
import ButtonNewCampaign from "@/components/ButtonNewCampaign";
import CardSending from "@/components/CardSending";
import ListDomainStatus from "@/components/ListDomainStatus";
import ListStats from "@/components/ListStats";
import SkeletonCampaigns from "@/components/SkeletonCampaigns";
import { SkeletonDomainList, SkeletonStats, SkeletonUsage } from "@/components/SkeletonOverview";
import StateEmpty from "@/components/StateEmpty";
import TableCampaigns from "@/components/TableCampaigns";
import TabsNewsletter from "@/components/TabsNewsletter";
import TextEmpty from "@/components/TextEmpty";
import { Button } from "@/components/ui/button";
import { requireMigma } from "@/lib/auth";
import { listNewslettersWithCounts } from "@/lib/contacts";
import { listRecentCampaigns } from "@/lib/data/campaigns";
import { formatNumber } from "@/lib/format";
import { call, listSendingDomains } from "@/lib/migma";
import { toNewsletterMap, toNewsletterOptions } from "@/lib/newsletters";
import { getEmailStats } from "@/lib/overview-data";
import { groupDomains } from "@/lib/sending-domains";
import { PERIOD_DAYS } from "@/lib/overview-series";
import { syncStaleCampaigns } from "@/lib/sending";

const OVERVIEW_DOMAINS = 5;

// Everything above Domains is about one newsletter, the largest unless ?newsletter= picks one.
export default async function OverviewPage({ searchParams }) {
	const [{ newsletter: newsletterParam }, { accountId, migma }] = await Promise.all([searchParams, requireMigma()]);
	const [newsletters] = await Promise.all([listNewslettersWithCounts(migma, accountId), syncStaleCampaigns(migma, accountId)]);
	const bySize = newsletters.toSorted((a, b) => (b.activeCount ?? 0) - (a.activeCount ?? 0));
	const selected = bySize.find(({ _id }) => _id.toString() === newsletterParam) ?? bySize[0];
	const selectedId = selected?._id.toString();

	return (
		<>
			<h1 className="sr-only">Overview</h1>

			<header className="mb-6 flex items-center justify-between gap-3 animate-enter">
				{selected ? (
					<div className="flex min-w-0 items-center gap-1">
						<TabsNewsletter newsletters={bySize} selectedId={selectedId} />
						<Link
							href={`/newsletters/${selectedId}`}
							aria-label={`${selected.name} settings`}
							title="Newsletter settings"
							className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
						>
							<Settings2 className="size-4" />
						</Link>
					</div>
				) : (
					<span />
				)}
				<div className="shrink-0">
					<ButtonNewCampaign newsletters={toNewsletterOptions(newsletters)} />
				</div>
			</header>

			<div className="flex flex-col gap-8">
				{selected ? (
					<>
						<Section title={`Last ${PERIOD_DAYS} days`} stagger={1}>
							<div className="overflow-hidden rounded-2xl bg-card shadow-border">
								<Suspense key={`stats-${selectedId}`} fallback={<SkeletonStats />}>
									<StatsEmail accountId={accountId} newsletterId={selected._id} />
								</Suspense>
								<div className="flex items-baseline justify-between gap-3 border-t border-border/60 px-5 py-4 sm:px-6">
									<h2 className="text-sm font-medium text-muted-foreground">Subscribers</h2>
									<p className="text-2xl font-semibold tracking-tight tabular-nums">
										{selected.activeCount === null ? <TextEmpty /> : formatNumber(selected.activeCount)}
									</p>
								</div>
							</div>
						</Section>

						<Section title="Campaigns" href="/campaigns" stagger={2}>
							<Suspense key={`campaigns-${selectedId}`} fallback={<SkeletonCampaigns rows={5} />}>
								<TableRecentCampaigns accountId={accountId} newsletterId={selected._id} newsletters={newsletters} />
							</Suspense>
						</Section>
					</>
				) : (
					<StateEmpty icon={Newspaper} title="Start your newsletter">
						<p className="max-w-sm text-sm text-muted-foreground">
							Name it and add your website, import your list, then write an issue or let Migma design one in your
							brand.
						</p>
						<Button asChild size="sm">
							<Link href="/newsletters/new">Create a newsletter</Link>
						</Button>
					</StateEmpty>
				)}

				<Section title="Domains" href="/domains" stagger={3}>
					<Suspense fallback={<SkeletonDomainList />}>
						<SectionDomains migma={migma} />
					</Suspense>
				</Section>

				<Section title="Sending" stagger={4}>
					<Suspense fallback={<SkeletonUsage />}>
						<StripUsage migma={migma} />
					</Suspense>
				</Section>
			</div>
		</>
	);
}

async function StatsEmail({ accountId, newsletterId }) {
	const stats = await getEmailStats({ accountId, newsletterId });
	return (
		<div className="animate-fade-in">
			<ListStats current={stats.current} previous={stats.previous} />
		</div>
	);
}

async function TableRecentCampaigns({ accountId, newsletterId, newsletters }) {
	const campaigns = await listRecentCampaigns({ accountId, limit: 5, newsletterId: String(newsletterId) });
	if (campaigns.length === 0) {
		return (
			<p className="rounded-xl px-4 py-6 text-center text-sm text-muted-foreground shadow-border animate-fade-in">
				No campaigns yet
			</p>
		);
	}
	return (
		<div className="animate-fade-in">
			<TableCampaigns campaigns={campaigns} newsletters={toNewsletterMap(newsletters)} />
		</div>
	);
}

function NoticeStrip({ icon: Icon = TriangleAlert, children }) {
	return (
		<p className="flex items-center gap-3 rounded-xl px-4 py-4 text-sm text-muted-foreground shadow-border animate-fade-in">
			<Icon className="size-4 shrink-0 text-amber-500" />
			<span className="min-w-0">{children}</span>
		</p>
	);
}

async function SectionDomains({ migma }) {
	let domains;
	try {
		domains = await listSendingDomains(migma);
	} catch (error) {
		return <NoticeStrip>Migma unreachable: {error.message}</NoticeStrip>;
	}
	if (domains.length === 0) {
		return (
			<NoticeStrip icon={Globe}>
				No sending domain yet.{" "}
				<Link href="/domains" className="font-medium text-foreground underline underline-offset-2">
					Set one up
				</Link>{" "}
				to start sending.
			</NoticeStrip>
		);
	}
	// Only domains that can send; the Domains page has the ones waiting.
	const groups = groupDomains(domains);
	const shown = groups.ready.slice(0, OVERVIEW_DOMAINS);
	const waiting = groups.dns.length + groups.suspended.length;
	const notes = [
		groups.ready.length > shown.length && `${formatNumber(groups.ready.length - shown.length)} more ready`,
		waiting > 0 && `${formatNumber(waiting)} waiting for DNS`,
		groups.failed.length > 0 && `${formatNumber(groups.failed.length)} didn't verify`,
	].filter(Boolean);
	return (
		<div className="flex flex-col gap-2 animate-fade-in">
			{shown.length > 0 ? (
				<ListDomainStatus domains={shown} />
			) : (
				<NoticeStrip icon={Globe}>No domain can send yet.</NoticeStrip>
			)}
			{notes.length > 0 && (
				<Link href="/domains" className="w-fit text-sm text-muted-foreground transition-colors hover:text-foreground">
					{notes.join(" · ")}
				</Link>
			)}
		</div>
	);
}

// The account's sending this month and today, against its Migma plan, with the last six months.
async function StripUsage({ migma }) {
	let usage;
	try {
		usage = await call(migma.metrics.sending({ months: 6 }));
	} catch (error) {
		return <NoticeStrip>Migma unreachable: {error.message}</NoticeStrip>;
	}
	return <CardSending usage={usage} />;
}

function Section({ title, href, stagger, children }) {
	return (
		<section style={{ "--stagger": stagger }} className="flex flex-col gap-3 animate-enter">
			<SectionTitle href={href}>{title}</SectionTitle>
			{children}
		</section>
	);
}

function SectionTitle({ href, children }) {
	if (!href) return <h2 className="text-sm font-medium text-muted-foreground">{children}</h2>;
	return (
		<h2 className="text-sm font-medium text-muted-foreground">
			<Link href={href} className="group inline-flex items-center gap-1 transition-colors hover:text-foreground">
				{children}
				<ChevronRight className="size-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
			</Link>
		</h2>
	);
}
