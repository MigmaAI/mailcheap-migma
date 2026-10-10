import "server-only";
import { PERIOD_DAYS } from "@/lib/overview-series";
import Campaign from "@/models/Campaign";

const DAY_MS = 24 * 60 * 60 * 1000;
const STAT_KEYS = ["delivered", "opened", "clicked", "bounced", "unsubscribed"];

// Each period adds up the Migma stats of the issues that went out in it (cached on each campaign and
// refreshed by lib/sending.js syncStaleCampaigns).
export async function getEmailStats({ accountId, newsletterId, now = new Date() }) {
	const periodStart = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
	const previousStart = new Date(now.getTime() - 2 * PERIOD_DAYS * DAY_MS);
	const rows = await Campaign.aggregate([
		{ $match: { accountId, newsletterId, status: { $in: ["sending", "sent"] }, startedAt: { $gte: previousStart } } },
		{
			$group: {
				_id: { $cond: [{ $gte: ["$startedAt", periodStart] }, "current", "previous"] },
				sent: { $sum: "$stats.recipients" },
				...Object.fromEntries(STAT_KEYS.map((key) => [key, { $sum: `$stats.${key}` }])),
			},
		},
	]);
	const empty = { sent: 0, ...Object.fromEntries(STAT_KEYS.map((key) => [key, 0])) };
	const byPeriod = Object.fromEntries(rows.map(({ _id, ...totals }) => [_id, totals]));
	return { current: byPeriod.current ?? empty, previous: byPeriod.previous ?? empty };
}
