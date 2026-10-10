import { notFound } from "next/navigation";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import CardCreateBrand from "@/components/CardCreateBrand";
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
	// A new account starts by creating its brand; a newsletter needs one that Migma has finished reading.
	const needsBrand = isNew && Array.isArray(brands) && !brands.some(({ importing }) => !importing);

	return (
		<>
			<HeaderPage
				title={isNew ? "New newsletter" : newsletter.name}
				backHref="/newsletters"
				icon={newsletter && <AvatarNewsletter newsletter={newsletter} size={32} />}
			/>
			{needsBrand ? (
				<CardCreateBrand importing={brands.find(({ importing }) => importing)} />
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
