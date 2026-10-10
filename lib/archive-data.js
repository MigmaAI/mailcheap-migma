import "server-only";
import { revalidatePath } from "next/cache";
import { cache } from "react";
import { getArchiveUrls } from "@/lib/archive-hosts";
import { getAccount } from "@/lib/data/accounts";
import {
	PUBLISHED_STATUSES,
	getArchiveIssue as findArchiveIssue,
	listArchiveIssues as findArchiveIssues,
	listSharedThumbnails,
} from "@/lib/data/campaigns";
import { getArchiveNewsletter as findArchiveNewsletter, saveReadersCount } from "@/lib/data/newsletters";
import { getListCount, migmaFor } from "@/lib/migma";
import { ARCHIVE_SLUG_PATTERN } from "@/lib/slug";

export { PUBLISHED_STATUSES } from "@/lib/data/campaigns";

const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
// The archive's reader count comes from Migma at most this often.
const READERS_MAX_AGE_MS = 60 * 60 * 1000;

export const getArchiveNewsletter = cache(async (slug) => {
	if (!SLUG_PATTERN.test(slug)) return null;
	return findArchiveNewsletter(slug);
});

// A picture several listed issues share is the newsletter's banner, not the issue's own. Those issues
// get a generated card instead, so the archive doesn't repeat one image on every card. Unlisted
// issues don't count.
const getSharedThumbnails = cache((newsletterId) => listSharedThumbnails(newsletterId));

async function withOwnThumbnails(newsletterId, issues) {
	const shared = await getSharedThumbnails(String(newsletterId));
	return issues.map((issue) => (shared.has(issue.thumbnailUrl) ? { ...issue, thumbnailUrl: undefined } : issue));
}

export const getArchiveIssue = cache(async (newsletterId, postSlug) => {
	if (!ARCHIVE_SLUG_PATTERN.test(postSlug)) return null;
	const issue = await findArchiveIssue(newsletterId, postSlug);
	return issue && (await withOwnThumbnails(newsletterId, [issue]))[0];
});

export async function listArchiveIssues(newsletterId, { limit, excludeId } = {}) {
	return withOwnThumbnails(newsletterId, await findArchiveIssues(String(newsletterId), { limit, excludeId }));
}

// The newsletter's subscribed readers in Migma, counted with its owner's key at most hourly and kept on
// the newsletter in between. Cached per render: the layout and the page show the same number.
export const countReaders = cache(async (newsletter) => {
	const isFresh = newsletter.readersCountedAt && Date.now() - newsletter.readersCountedAt.getTime() < READERS_MAX_AGE_MS;
	if (isFresh) return newsletter.readersCount ?? 0;
	const account = await getAccount(newsletter.accountId);
	if (!account) return newsletter.readersCount ?? 0;
	try {
		const count = await getListCount(migmaFor(account), newsletter);
		await saveReadersCount(newsletter._id, count);
		return count;
	} catch (error) {
		console.warn("[archive] Couldn't count readers:", error.message);
		return newsletter.readersCount ?? 0;
	}
});

// Archive pages render on each visit (no cache to refresh); kept so callers say when they changed.
export function revalidateArchive() {
	revalidatePath("/archive/[slug]", "layout");
}

// Unlisted issues keep their page, so only the archive switch, the slug and the send decide.
export function getIssuePageUrl({ campaign, newsletter }) {
	if (!newsletter?.archiveEnabled || !campaign.archiveSlug || !PUBLISHED_STATUSES.includes(campaign.status)) return null;
	return getArchiveUrls(newsletter).absolutePost(campaign.archiveSlug);
}
