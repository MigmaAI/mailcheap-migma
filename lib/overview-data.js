import "server-only";
import { sumStats } from "@/lib/data/campaigns";
import { PERIOD_DAYS } from "@/lib/overview-series";

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY = { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };

// Each period adds up the Migma stats of the issues that went out in it (kept on each campaign and
// refreshed by lib/sending.js syncStaleCampaigns).
export async function getEmailStats({ accountId, newsletterId, now = new Date() }) {
	const periodStart = new Date(now.getTime() - PERIOD_DAYS * DAY_MS);
	const previousStart = new Date(now.getTime() - 2 * PERIOD_DAYS * DAY_MS);
	const byPeriod = await sumStats({ accountId, newsletterId: String(newsletterId), periodStart, previousStart });
	return { current: { ...EMPTY, ...byPeriod.current }, previous: { ...EMPTY, ...byPeriod.previous } };
}
