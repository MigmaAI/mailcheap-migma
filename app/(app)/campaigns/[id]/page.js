import { notFound } from "next/navigation";
import CampaignReport from "@/components/CampaignReport";
import FormCampaign from "@/components/FormCampaign";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { requireMigma } from "@/lib/auth";
import { isSendingEnabled } from "@/lib/config";
import { getCampaign, listSendTimes } from "@/lib/data/campaigns";
import { getNewsletter } from "@/lib/data/newsletters";
import { getListCount, listSendingDomains } from "@/lib/migma";
import { syncCampaign } from "@/lib/sending";
import { serialize } from "@/lib/serialize";
import { isObjectIdString } from "@/lib/validation";

export const metadata = { title: "Campaign" };

export default async function CampaignPage({ params }) {
	const { id } = await params;
	if (!isObjectIdString(id)) notFound();

	const { account, accountId, migma } = await requireMigma();
	const stored = await getCampaign(accountId, id);
	if (!stored) notFound();
	const newsletter = await getNewsletter(accountId, stored.newsletterId);
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
	const own = await listSendTimes({ accountId, newsletterId, excludeId });
	const rows = own.length > 0 ? own : await listSendTimes({ accountId, excludeId });
	return {
		history: rows.map(({ at }) => at.toISOString()),
		taken: own.filter(({ status }) => status === "scheduled").map(({ at }) => at.toISOString()),
	};
}
