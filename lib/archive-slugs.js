import "server-only";
import { isArchiveSlugTaken, updateCampaign } from "@/lib/data/campaigns";
import { slugify } from "@/lib/slug";

export async function uniqueArchiveSlug(base, exceptId) {
	for (let suffix = 1; suffix < 100; suffix += 1) {
		const slug = suffix === 1 ? base : `${base}-${suffix}`;
		if (!(await isArchiveSlugTaken(slug, exceptId))) return slug;
	}
	return `${base}-${Date.now()}`;
}

// The slug comes from the subject as it is when the issue goes out, so the /p/ page exists before the
// first email links to it.
export async function assignArchiveSlug({ campaign, newsletter }) {
	if (!newsletter.archiveEnabled || campaign.archiveSlug) return;
	const archiveSlug = await uniqueArchiveSlug(slugify(campaign.subject, 80) || "issue", campaign._id);
	await updateCampaign({ id: campaign._id, accountId: campaign.accountId }, { archiveSlug });
}
