import { notFound } from "next/navigation";
import CampaignReport from "@/components/CampaignReport";
import FormCampaign from "@/components/FormCampaign";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { requireMigma } from "@/lib/auth";
import { isSendingEnabled } from "@/lib/config";
import { getCampaign, listSendTimes } from "@/lib/data/campaigns";
import { getNewsletter } from "@/lib/data/newsletters";
import { getListCount, listSendingDomains } from "@/lib/migma";
import { RECIPIENT_FILTERS, getCampaignReport, syncCampaign } from "@/lib/sending";
import { serialize } from "@/lib/serialize";
import { isObjectIdString } from "@/lib/validation";

export const metadata = { title: "Campaign" };

const CURSOR_PATTERN = /^[\w\-=+/.:]{1,512}$/;

export default async function CampaignPage({ params, searchParams }) {
	const [{ id }, query] = await Promise.all([params, searchParams]);
	if (!isObjectIdString(id)) notFound();

	const { account, accountId, migma } = await requireMigma();
	const stored = await getCampaign(accountId, id);
	if (!stored) notFound();
	const newsletter = await getNewsletter(accountId, stored.newsletterId);
	if (!newsletter) notFound();
	// A scheduled issue may have gone out since; a draft has nothing in Migma yet.
	const campaign = stored.status === "scheduled" ? await syncCampaign(migma, stored).catch(() => stored) : stored;

	if (!["draft", "scheduled"].includes(campaign.status)) {
		const filter = RECIPIENT_FILTERS.includes(query.recipients) ? query.recipients : null;
		const cursor = typeof query.cursor === "string" && CURSOR_PATTERN.test(query.cursor) ? query.cursor : null;
		const report = await getCampaignReport(migma, campaign, { filter, cursor }).catch((error) => ({
			campaign,
			statsError: error.message,
			recipientsError: error.message,
		}));
		return (
			<CampaignReport
				campaign={serialize(report.campaign)}
				newsletter={serialize(newsletter)}
				remote={report.remote ? serialize(report.remote) : null}
				stats={report.stats ? serialize(report.stats) : null}
				statsError={report.statsError ?? null}
				recipients={report.recipients ? serialize(report.recipients) : null}
				recipientsError={report.recipientsError ?? null}
				filter={filter}
				cursor={cursor}
			/>
		);
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
