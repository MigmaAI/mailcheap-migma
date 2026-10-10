import { CircleAlert, Copy, ExternalLink, Pin, PinOff, RefreshCw } from "lucide-react";
import { duplicateCampaign, refreshCampaign, toggleArchivePin } from "@/app/(app)/campaigns/actions";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import BadgeStatus from "@/components/BadgeStatus";
import ButtonCampaignAction from "@/components/ButtonCampaignAction";
import ButtonCopy from "@/components/ButtonCopy";
import CardStat from "@/components/CardStat";
import HeaderPage from "@/components/HeaderPage";
import InputCampaignSlug from "@/components/InputCampaignSlug";
import PreviewEmail from "@/components/PreviewEmail";
import TableRecipients from "@/components/TableRecipients";
import { Button } from "@/components/ui/button";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { MIGMA_APP_URL } from "@/lib/config";
import { formatDate, formatNumber, formatRate, formatRelative, formatSendTime } from "@/lib/format";
import { UNSUBSCRIBE_PLACEHOLDER, renderEmail, withResponsiveImages } from "@/lib/render-email";

const STATUS_NOTES = {
	review: "Migma checks first sends from new accounts and large sends before they go out. It usually takes a few minutes.",
	sending: "Migma is sending it. Numbers fill in as readers open and click.",
};

function formatMoney(amount, currency) {
	if (!currency) return formatNumber(Math.round(amount));
	return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

// What Migma's numbers leave out and how fresh they are, in one line.
function describeStats(stats) {
	if (!stats) return null;
	const filtered = [
		stats.botOpens > 0 && `${formatNumber(stats.botOpens)} bot opens`,
		stats.mppOpens > 0 && `${formatNumber(stats.mppOpens)} Apple Mail privacy opens`,
		stats.botClicks > 0 && `${formatNumber(stats.botClicks)} link scanner clicks`,
	].filter(Boolean);
	const updatedAt = stats.reporting?.updatedAt ?? stats.lastUpdated;
	const freshness =
		stats.reporting?.status === "cached"
			? `Saved numbers from ${formatRelative(updatedAt)}${stats.reporting.reason ? ` (${stats.reporting.reason})` : ""}`
			: updatedAt && `Updated ${formatRelative(updatedAt)}`;
	return [filtered.length > 0 && `Leaves out ${filtered.join(", ")}.`, freshness].filter(Boolean).join(" ");
}

export default function CampaignReport({ campaign, newsletter, remote, stats, statsError, recipients, recipientsError, filter, cursor }) {
	const counts = campaign.stats ?? {};
	const id = campaign._id.toString();
	const isOnArchive = newsletter.archiveEnabled && Boolean(campaign.archiveSlug) && campaign.archiveListed !== false;
	const reached = counts.delivered || counts.recipients;
	const conversion = stats?.conversion;
	const failure = campaign.status === "failed" ? remote?.error || "Migma couldn't send this issue." : null;
	// What Migma sent; the draft's own render for anything sent before it was kept.
	const html =
		campaign.migma?.html ||
		renderEmail({
			format: campaign.format,
			markdown: campaign.markdown,
			html: campaign.html,
			subject: campaign.subject,
			previewText: campaign.previewText,
			newsletter,
		}).html;
	const timing = [
		campaign.sentAt && `Sent ${formatSendTime(campaign.sentAt)}`,
		remote?.completedAt && `finished ${formatRelative(remote.completedAt)}`,
		remote?.estimatedRecipients && `to ${formatNumber(remote.estimatedRecipients)} subscribers`,
	].filter(Boolean);
	const note = describeStats(stats) ?? (statsError ? `Migma's stats aren't available right now: ${statsError}` : null);

	return (
		<>
			<HeaderPage
				title={campaign.subject || "Untitled"}
				backHref="/campaigns"
				icon={<AvatarNewsletter newsletter={newsletter} size={28} />}
				meta={<BadgeStatus status={campaign.status} />}
			>
				<ButtonCampaignAction action={refreshCampaign} id={id}>
					<RefreshCw data-icon="inline-start" />
					Refresh
				</ButtonCampaignAction>
				{campaign.migma?.campaignId && (
					<Button variant="outline" asChild>
						<a href={`${MIGMA_APP_URL}/campaigns/${campaign.migma.campaignId}`} target="_blank" rel="noreferrer">
							<ExternalLink data-icon="inline-start" />
							Migma
						</a>
					</Button>
				)}
				{isOnArchive && (
					<>
						<Button variant="outline" asChild>
							<a href={getArchiveUrls(newsletter).post(campaign.archiveSlug)} target="_blank" rel="noreferrer">
								<ExternalLink data-icon="inline-start" />
								View page
							</a>
						</Button>
						<ButtonCampaignAction action={toggleArchivePin} id={id}>
							{campaign.archivePinned ? <PinOff data-icon="inline-start" /> : <Pin data-icon="inline-start" />}
							{campaign.archivePinned ? "Unpin" : "Pin"}
						</ButtonCampaignAction>
					</>
				)}
				<ButtonCampaignAction action={duplicateCampaign} id={id}>
					<Copy data-icon="inline-start" />
					Duplicate
				</ButtonCampaignAction>
			</HeaderPage>

			<div className="flex flex-col gap-6">
				{timing.length > 0 && <p className="-mt-2 text-sm text-muted-foreground tabular-nums">{timing.join(" · ")}</p>}

				{failure && (
					<p role="alert" className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-border">
						<CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
						<span>
							<span className="font-medium">Not sent.</span> <span className="text-muted-foreground">{failure}</span>
						</span>
					</p>
				)}
				{STATUS_NOTES[campaign.status] && (
					<p className="rounded-xl px-4 py-3 text-sm text-muted-foreground shadow-border">{STATUS_NOTES[campaign.status]}</p>
				)}

				<div className="flex flex-col gap-2">
					<div className="grid grid-cols-2 gap-3 animate-enter sm:grid-cols-3 lg:grid-cols-5">
						<CardStat
							label="Delivered"
							value={formatRate(counts.delivered, counts.recipients)}
							detail={`${formatNumber(counts.delivered)} of ${formatNumber(counts.recipients)}`}
						/>
						<CardStat
							label="Opened"
							value={formatRate(counts.opened, reached)}
							detail={stats ? `${formatNumber(stats.uniqueOpens)} people · ${formatNumber(stats.totalOpens)} opens` : formatNumber(counts.opened)}
						/>
						<CardStat
							label="Clicked"
							value={formatRate(counts.clicked, reached)}
							detail={stats ? `${formatNumber(stats.uniqueClicks)} people · ${formatNumber(stats.totalClicks)} clicks` : formatNumber(counts.clicked)}
						/>
						<CardStat label="Bounced" value={formatRate(counts.bounced, counts.recipients, 2)} detail={formatNumber(counts.bounced)} />
						<CardStat label="Unsubscribed" value={formatRate(counts.unsubscribed, reached, 2)} detail={formatNumber(counts.unsubscribed)} />
					</div>
					{note && <p className="text-xs text-muted-foreground">{note}</p>}
				</div>

				{conversion && (
					<div className="flex flex-wrap items-baseline justify-between gap-3 rounded-xl bg-card px-4 py-3.5 shadow-border">
						<div className="flex flex-col gap-0.5">
							<span className="text-xs text-muted-foreground">Attributed revenue</span>
							<span className="text-lg font-semibold tracking-tight tabular-nums">
								{conversion.revenue === undefined || conversion.revenue === null
									? `${formatNumber(conversion.conversions)} orders`
									: formatMoney(conversion.revenue, conversion.currency)}
							</span>
						</div>
						<p className="max-w-sm text-xs text-pretty text-muted-foreground">
							{formatNumber(conversion.conversions)} {conversion.conversions === 1 ? "order" : "orders"} within five days of a
							click on this issue. Credited to it, not proven extra sales.
						</p>
					</div>
				)}

				{newsletter.archiveEnabled && campaign.archiveSlug && (
					<div className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-xl bg-card px-4 shadow-border transition-colors duration-150 focus-within:bg-muted/40">
						<span className="text-sm text-muted-foreground">URL</span>
						<InputCampaignSlug
							campaignId={id}
							initialSlug={campaign.archiveSlug}
							urlBase={getArchiveUrls(newsletter).absolutePost("")}
							isPublished
						/>
						<ButtonCopy value={getArchiveUrls(newsletter).absolutePost(campaign.archiveSlug)} label="Copy link" />
					</div>
				)}

				{campaign.migma?.campaignId && (
					<TableRecipients
						base={`/campaigns/${id}`}
						recipients={recipients}
						error={recipientsError}
						filter={filter}
						cursor={cursor}
					/>
				)}

				<PreviewEmail
					fit="content"
					sender={newsletter}
					subject={campaign.subject}
					previewText={campaign.previewText}
					html={withResponsiveImages(html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, "#"))}
					// Rendered next to PreviewEmail's own children, so dev React asks for a key.
					toolbar={
						<span key="toolbar" className="truncate text-xs text-muted-foreground">
							{newsletter.name}
							{campaign.sentAt && ` · ${formatDate(campaign.sentAt)}`}
						</span>
					}
				/>
			</div>
		</>
	);
}
