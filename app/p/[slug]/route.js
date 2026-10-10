import { getArchiveUrls } from "@/lib/archive-hosts";
import { getNewsletterIdForSlug } from "@/lib/data/campaigns";
import { getPublicNewsletter } from "@/lib/data/newsletters";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

// Archive domains rewrite /p/slug in proxy.js; on the app's domain the link doesn't name the newsletter.
export async function GET(request, { params }) {
	const { slug } = await params;
	if (!SLUG_PATTERN.test(slug)) return new Response("Not found", { status: 404 });

	const newsletterId = await getNewsletterIdForSlug(slug);
	const newsletter = newsletterId && (await getPublicNewsletter(newsletterId));
	if (!newsletter) return new Response("Not found", { status: 404 });

	return Response.redirect(new URL(getArchiveUrls(newsletter).post(slug), request.url), 307);
}
