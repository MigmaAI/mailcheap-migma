import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, Globe, Newspaper, Settings2, TriangleAlert } from "lucide-react";
import ButtonNewCampaign from "@/components/ButtonNewCampaign";
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
import { recentCampaignsPipeline } from "@/lib/campaign-queries";
import { listNewslettersWithCounts } from "@/lib/contacts";
import { formatCompact, formatNumber } from "@/lib/format";
import { call, listSendingDomains } from "@/lib/migma";
import { toNewsletterMap, toNewsletterOptions } from "@/lib/newsletters";
import { getEmailStats } from "@/lib/overview-data";
import { PERIOD_DAYS } from "@/lib/overview-series";
import { syncStaleCampaigns } from "@/lib/sending";
import Campaign from "@/models/Campaign";

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
							Create a newsletter on one of your Migma brands, import your list, then write an issue or let Migma
							design one.
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
	const campaigns = await Campaign.aggregate(recentCampaignsPipeline({ accountId, limit: 5, newsletterId }));
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
	return (
		<div className="animate-fade-in">
			<ListDomainStatus domains={domains} />
		</div>
	);
}

// The account's sending this month and today, against its Migma plan.
async function StripUsage({ migma }) {
	let usage;
	try {
		usage = await call(migma.metrics.sending());
	} catch (error) {
		return <NoticeStrip>Migma unreachable: {error.message}</NoticeStrip>;
	}

	const items = [
		{ label: "Sent this month", value: <Quota used={usage.monthly.sent} limit={usage.monthlyLimit} /> },
		{ label: "Sent today", value: <Quota used={usage.today.sent} limit={usage.today.dailyLimit} /> },
		{ label: "Delivered this month", value: formatNumber(usage.monthly.delivered) },
		{ label: "Bounced · complaints", value: `${formatNumber(usage.monthly.bounced)} · ${formatNumber(usage.monthly.complained)}` },
	];

	return (
		<div className="overflow-hidden rounded-xl bg-card shadow-border animate-fade-in">
			<dl className="grid grid-cols-2 gap-px bg-border/60 lg:grid-cols-4">
				{items.map(({ label, value }) => (
					<div key={label} className="flex min-h-[66px] flex-col items-start justify-center gap-1.5 bg-card px-4 py-3">
						<dt className="text-xs text-muted-foreground">{label}</dt>
						<dd className="w-full text-sm font-medium tabular-nums">{value}</dd>
					</div>
				))}
			</dl>
		</div>
	);
}

function Quota({ used, limit }) {
	const share = limit ? Math.min(used / limit, 1) : 0;
	return (
		<span className="flex w-full flex-col gap-1.5">
			{formatNumber(used)} / {limit ? formatCompact(limit) : "—"}
			<span className="h-1 w-full max-w-32 overflow-hidden rounded-full bg-muted">
				<span
					className="block h-full rounded-full bg-foreground/70"
					style={{ width: `${Math.max(share * 100, share > 0 ? 2 : 0)}%` }}
				/>
			</span>
		</span>
	);
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
