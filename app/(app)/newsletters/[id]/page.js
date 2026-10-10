import { notFound } from "next/navigation";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import FormNewsletter from "@/components/FormNewsletter";
import HeaderPage from "@/components/HeaderPage";
import { requireMigma } from "@/lib/auth";
import { getNewsletter } from "@/lib/data/newsletters";
import { listBrands, listSendingDomains } from "@/lib/migma";
import { serialize } from "@/lib/serialize";
import { isObjectIdString } from "@/lib/validation";

export const metadata = { title: "Newsletter" };

export default async function NewsletterPage({ params }) {
	const { id } = await params;
	const isNew = id === "new";
	if (!isNew && !isObjectIdString(id)) notFound();

	const { accountId, migma } = await requireMigma();
	const [newsletter, brands, sendingDomains] = await Promise.all([
		isNew ? null : getNewsletter(accountId, id),
		listBrands(migma).catch(() => null),
		listSendingDomains(migma).catch(() => null),
	]);
	if (!isNew && !newsletter) notFound();

	return (
		<>
			<HeaderPage
				title={isNew ? "New newsletter" : newsletter.name}
				backHref="/newsletters"
				icon={newsletter && <AvatarNewsletter newsletter={newsletter} size={32} />}
			/>
			{isNew && brands?.length === 0 ? (
				<p className="rounded-xl px-4 py-6 text-center text-sm text-muted-foreground shadow-border">
					Your Migma account has no brand yet. Create one in Migma (it takes your website and picks up your logo and
					colors), then come back.
				</p>
			) : (
				<FormNewsletter
					newsletter={newsletter ? serialize(newsletter) : null}
					brands={brands}
					sendingDomains={sendingDomains}
				/>
			)}
		</>
	);
}
