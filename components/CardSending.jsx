import InfoTip from "@/components/InfoTip";
import { formatCompact, formatCount, formatNumber, formatRate } from "@/lib/format";
import { cn } from "@/lib/utils";

const MONTH_FORMAT = { month: "short", timeZone: "UTC" };

function monthLabel(period) {
	const [year, month] = period.split("-").map(Number);
	return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", MONTH_FORMAT);
}

// The account's sending from Migma: this month against the plan, today against the daily limit, how much
// arrived, and the last months side by side.
export default function CardSending({ usage }) {
	const { monthly, today, monthlyLimit, remainingMonth } = usage;
	// History's order isn't promised, and it may already hold the current month.
	const months = [...(usage.history ?? []).filter(({ period }) => period !== usage.period), { period: usage.period, ...monthly }]
		.toSorted((a, b) => a.period.localeCompare(b.period))
		.slice(-7);
	const peak = Math.max(1, ...months.map(({ sent }) => sent));
	const bounceShare = monthly.sent ? monthly.bounced / monthly.sent : 0;

	const items = [
		{
			label: "This month",
			value: formatNumber(monthly.sent),
			detail: monthlyLimit ? `of ${formatCompact(monthlyLimit)} · ${formatCompact(remainingMonth)} left` : null,
			share: monthlyLimit ? monthly.sent / monthlyLimit : null,
		},
		{
			label: "Today",
			// Two limits people mix up: the plan's, and the one on instant domains.
			info: "Your Migma plan's daily limit, across all your domains. An instant migma.email domain also sends to at most 50 people a day; add your own domain to use the full limit.",
			value: formatNumber(today.sent),
			detail: today.dailyLimit ? `of ${formatCompact(today.dailyLimit)} · ${formatCompact(today.remainingToday)} left` : null,
			share: today.dailyLimit ? today.sent / today.dailyLimit : null,
		},
		{
			label: "Delivered",
			value: formatRate(monthly.delivered, monthly.sent) ?? "–",
			detail: formatCount(monthly.delivered, "email"),
		},
		{
			label: "Bounced · complaints",
			value: formatRate(monthly.bounced, monthly.sent, 2) ?? "–",
			detail: `${formatNumber(monthly.bounced)} bounced · ${formatCount(monthly.complained, "complaint")}`,
			tone: bounceShare > 0.05 ? "bad" : bounceShare > 0.02 ? "warn" : null,
		},
	];

	return (
		<div className="overflow-hidden rounded-2xl bg-card shadow-border animate-fade-in">
			<dl className="grid grid-cols-2 gap-px bg-border/60 lg:grid-cols-4">
				{items.map(({ label, info, value, detail, share, tone }) => (
					<div key={label} className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3.5 sm:px-5">
						<dt className="flex items-center gap-1 text-xs text-muted-foreground">
							{label}
							{info && <InfoTip label={`About ${label.toLowerCase()}`}>{info}</InfoTip>}
						</dt>
						<dd
							className={cn(
								"text-lg font-semibold tracking-tight tabular-nums",
								tone === "warn" && "text-amber-600 dark:text-amber-400",
								tone === "bad" && "text-red-600 dark:text-red-400"
							)}
						>
							{value}
						</dd>
						{share !== undefined && share !== null && (
							<dd className="h-1 w-full max-w-40 overflow-hidden rounded-full bg-muted">
								<span
									className="block h-full rounded-full bg-foreground/70"
									style={{ width: `${Math.min(100, Math.max(share * 100, share > 0 ? 2 : 0))}%` }}
								/>
							</dd>
						)}
						{detail && <dd className="truncate text-xs text-muted-foreground tabular-nums">{detail}</dd>}
					</div>
				))}
			</dl>
			{months.length > 1 && (
				<div className="border-t border-border/60 px-4 py-4 sm:px-5">
					<p className="mb-3 text-xs text-muted-foreground">Emails sent per month</p>
					<ol className="flex h-24 items-end gap-2">
						{months.map(({ period, sent, delivered }) => {
							const isCurrent = period === usage.period;
							return (
								<li key={period} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
									<span className="text-[11px] text-muted-foreground tabular-nums">{sent ? formatCompact(sent) : ""}</span>
									<span
										title={`${monthLabel(period)}: ${formatNumber(sent)} sent, ${formatNumber(delivered)} delivered`}
										className={cn("w-full max-w-10 rounded-t-md", isCurrent ? "bg-foreground/80" : "bg-foreground/15")}
										style={{ height: `${Math.max((sent / peak) * 100, sent ? 3 : 1)}%` }}
									/>
									<span className={cn("text-[11px] tabular-nums", isCurrent ? "text-foreground" : "text-muted-foreground")}>
										{monthLabel(period)}
									</span>
								</li>
							);
						})}
					</ol>
				</div>
			)}
		</div>
	);
}
