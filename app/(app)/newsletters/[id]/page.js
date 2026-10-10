import { notFound } from "next/navigation";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import FormNewsletter from "@/components/FormNewsletter";
import HeaderPage from "@/components/HeaderPage";
import NoticeBrandImport from "@/components/NoticeBrandImport";
import { requireMigma } from "@/lib/auth";
import { toSiteHost } from "@/lib/brands";
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
	const brand = newsletter && brands?.find(({ id: brandId }) => brandId === newsletter.migma.projectId);

	return (
		<>
			<HeaderPage
				title={isNew ? "New newsletter" : newsletter.name}
				backHref="/newsletters"
				icon={newsletter && <AvatarNewsletter newsletter={newsletter} size={32} />}
			/>
			<div className="flex flex-col gap-4">
				{(brand?.importing || brand?.failed) && (
					<NoticeBrandImport newsletterId={id} site={toSiteHost(brand.domain) ?? brand.name} isFailed={brand.failed} />
				)}
				<FormNewsletter
					newsletter={newsletter ? serialize(newsletter) : null}
					brands={brands}
					sendingDomains={sendingDomains}
				/>
			</div>
		</>
	);
}
