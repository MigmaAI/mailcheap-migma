import { isValidObjectId } from "mongoose";
import { notFound } from "next/navigation";
import CampaignReport from "@/components/CampaignReport";
import FormCampaign from "@/components/FormCampaign";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { requireMigma } from "@/lib/auth";
import { sendTimesPipeline } from "@/lib/campaign-queries";
import { isSendingEnabled } from "@/lib/config";
import { getListCount, listSendingDomains } from "@/lib/migma";
import { syncCampaign } from "@/lib/sending";
import { serialize } from "@/lib/serialize";
import Campaign from "@/models/Campaign";
import Newsletter from "@/models/Newsletter";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }) {
	const { id } = await params;
	if (!isValidObjectId(id)) notFound();

	const { account, accountId, migma } = await requireMigma();
	const stored = await Campaign.findOne({ _id: id, accountId }).lean();
	if (!stored) notFound();
	const newsletter = await Newsletter.findOne({ _id: stored.newsletterId, accountId }).lean();
	if (!newsletter) notFound();
	const campaign = await syncCampaign(migma, stored).catch(() => stored);

	if (!["draft", "scheduled"].includes(campaign.status)) {
		return <CampaignReport campaign={serialize(campaign)} newsletter={serialize(newsletter)} />;
	}

	const [audienceCount, domains, sendTimes] = await Promise.all([
		getListCount(migma, newsletter).catch(() => null),
		listSendingDomains(migma).catch(() => null),
		getSendTimes(campaign),
	]);

	return (
		<FormCampaign
			// A finished Migma design replaces the whole draft, so the form starts over with it.
			key={campaign.migma?.designing ? "designing" : "draft"}
			campaign={serialize(campaign)}
			newsletter={serialize(newsletter)}
			audienceCount={audienceCount}
			isDomainVerified={isSendableFrom(newsletter.fromEmail, domains)}
			isSendingEnabled={isSendingEnabled()}
			testEmail={account.testEmail ?? ""}
			sendTimes={sendTimes}
			archiveUrlBase={newsletter.archiveEnabled ? getArchiveUrls(newsletter).absolutePost("") : null}
		/>
	);
}

// Migma sends from a verified domain or any address under one (mail.example.com under example.com).
function isSendableFrom(fromEmail, domains) {
	const fromDomain = fromEmail.split("@")[1]?.toLowerCase();
	if (!fromDomain || !Array.isArray(domains)) return false;
	return domains.some(({ domain, verified }) => verified && (fromDomain === domain || fromDomain.endsWith(`.${domain}`)));
}

// A newsletter's first issue borrows the times the account's other newsletters go out.
async function getSendTimes(campaign) {
	const { accountId, newsletterId, _id: excludeId } = campaign;
	const own = await Campaign.aggregate(sendTimesPipeline({ accountId, newsletterId, excludeId }));
	const rows = own.length > 0 ? own : await Campaign.aggregate(sendTimesPipeline({ accountId, excludeId }));
	return {
		history: rows.map(({ at }) => at.toISOString()),
		taken: own.filter(({ status }) => status === "scheduled").map(({ at }) => at.toISOString()),
	};
}
