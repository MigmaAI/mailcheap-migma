import { Copy, ExternalLink, Pin, PinOff, RefreshCw } from "lucide-react";
import { duplicateCampaign, refreshCampaign, toggleArchivePin } from "@/app/(app)/campaigns/actions";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import BadgeStatus from "@/components/BadgeStatus";
import ButtonCampaignAction from "@/components/ButtonCampaignAction";
import ButtonCopy from "@/components/ButtonCopy";
import CardStat from "@/components/CardStat";
import HeaderPage from "@/components/HeaderPage";
import InputCampaignSlug from "@/components/InputCampaignSlug";
import PreviewEmail from "@/components/PreviewEmail";
import { Button } from "@/components/ui/button";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { MIGMA_APP_URL } from "@/lib/config";
import { formatDate, formatNumber, formatRate } from "@/lib/format";
import { UNSUBSCRIBE_PLACEHOLDER, renderEmail, withResponsiveImages } from "@/lib/render-email";

const STATUS_NOTES = {
	review: "Migma checks first sends from new accounts and large sends before they go out. It usually takes a few minutes.",
	sending: "Migma is sending it. Numbers fill in as readers open and click.",
	failed: "Migma couldn't send this issue. Its reason is on the campaign in Migma.",
};

export default function CampaignReport({ campaign, newsletter }) {
	const stats = campaign.stats ?? {};
	const id = campaign._id.toString();
	const isOnArchive = newsletter.archiveEnabled && Boolean(campaign.archiveSlug) && campaign.archiveListed !== false;
	const reached = stats.delivered || stats.recipients;
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
				{STATUS_NOTES[campaign.status] && (
					<p className="rounded-xl px-4 py-3 text-sm text-muted-foreground shadow-border animate-enter">
						{STATUS_NOTES[campaign.status]}
					</p>
				)}

				<div style={{ "--stagger": 1 }} className="grid grid-cols-2 gap-3 animate-enter sm:grid-cols-3 lg:grid-cols-5">
					<CardStat
						label="Delivered"
						value={formatRate(stats.delivered, stats.recipients)}
						detail={`${formatNumber(stats.delivered)} of ${formatNumber(stats.recipients)}`}
					/>
					<CardStat label="Opened" value={formatRate(stats.opened, reached)} detail={formatNumber(stats.opened)} />
					<CardStat label="Clicked" value={formatRate(stats.clicked, reached)} detail={formatNumber(stats.clicked)} />
					<CardStat label="Bounced" value={formatRate(stats.bounced, stats.recipients, 2)} detail={formatNumber(stats.bounced)} />
					<CardStat
						label="Unsubscribed"
						value={formatRate(stats.unsubscribed, reached, 2)}
						detail={formatNumber(stats.unsubscribed)}
					/>
				</div>
				{stats.updatedAt && (
					<p className="-mt-3 text-xs text-muted-foreground">
						From Migma, updated {formatDate(stats.updatedAt)}. Opens leave out bots and Apple Mail privacy prefetches.
					</p>
				)}

				{newsletter.archiveEnabled && campaign.archiveSlug && (
					<div
						style={{ "--stagger": 3 }}
						className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-xl bg-card px-4 shadow-border transition-colors duration-150 animate-enter focus-within:bg-muted/40"
					>
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

				<div style={{ "--stagger": 4 }} className="animate-enter">
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
			</div>
		</>
	);
}
