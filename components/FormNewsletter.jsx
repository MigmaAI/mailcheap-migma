"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveNewsletter } from "@/app/(app)/newsletters/actions";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MAX_AUTHOR_BIO_LENGTH, MAX_DESCRIPTION_LENGTH } from "@/lib/newsletters";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

const IMAGE_PREVIEW_PATTERN = /^(https:\/\/\S+\.\S{2,}\/\S+|\/\S+\.\w{3,4})$/;

export default function FormNewsletter({ newsletter, brands, sendingDomains }) {
	const [state, action, isPending] = useActionState(saveNewsletter, null);
	const [name, setName] = useState(newsletter?.name ?? "");
	const [slug, setSlug] = useState(newsletter?.slug ?? "");
	const [isSlugEdited, setIsSlugEdited] = useState(Boolean(newsletter));
	const [fromName, setFromName] = useState(newsletter?.fromName ?? "");
	const [fromEmail, setFromEmail] = useState(newsletter?.fromEmail ?? "");
	const [imageUrl, setImageUrl] = useState(newsletter?.imageUrl ?? "");
	const [isArchiveEnabled, setIsArchiveEnabled] = useState(Boolean(newsletter?.archiveEnabled));
	const [projectId, setProjectId] = useState(newsletter?.migma?.projectId ?? brands?.[0]?.id ?? "");

	useEffect(() => {
		if (state?.ok) toast.success("Saved");
		if (state?.error) toast.error(state.error);
	}, [state]);

	const brand = brands?.find(({ id }) => id === projectId);
	// A new newsletter without its own image takes its brand's logo (newsletters/actions.js).
	const previewImageUrl = IMAGE_PREVIEW_PATTERN.test(imageUrl) ? imageUrl : !newsletter ? (brand?.logoUrl ?? "") : "";
	const senderHint = getSenderHint(fromEmail, sendingDomains);

	return (
		<form action={action} className="flex flex-col gap-4">
			{newsletter && <input type="hidden" name="id" value={newsletter._id} />}

			<Section title="General" stagger={0}>
				<Field label="Name">
					<Input
						name="name"
						value={name}
						required
						placeholder="Field notes"
						onChange={(event) => {
							setName(event.target.value);
							if (!isSlugEdited) setSlug(slugify(event.target.value));
						}}
					/>
				</Field>
				<Field label="Slug">
					<Input
						name="slug"
						value={slug}
						required
						placeholder="field-notes"
						className="font-mono"
						onChange={(event) => {
							setSlug(event.target.value);
							setIsSlugEdited(true);
						}}
					/>
				</Field>
				<Field
					label="Image"
					hint={!newsletter && brand?.logoUrl && !imageUrl ? `Uses ${brand.name}'s logo unless you add one` : "Square logo, 128×128 or larger"}
				>
					<span className="flex items-center gap-3">
						<AvatarNewsletter newsletter={{ name, imageUrl: previewImageUrl }} size={36} />
						<Input
							name="imageUrl"
							value={imageUrl}
							placeholder="https://example.com/logo.png"
							onChange={(event) => setImageUrl(event.target.value)}
						/>
					</span>
				</Field>
			</Section>

			<Section title="Migma" stagger={1}>
				<Field
					label="Brand"
					hint={
						newsletter
							? "Subscribers are contacts on this brand in Migma, on their own list."
							: "Its colors and logo shape emails Migma designs. Subscribers become contacts on this brand."
					}
				>
					{newsletter ? (
						<span className="flex h-9 items-center">{brand ? <BrandOption brand={brand} /> : "Brand in Migma"}</span>
					) : (
						<>
							<input type="hidden" name="projectId" value={projectId} />
							<Select value={projectId} onValueChange={setProjectId}>
								<SelectTrigger className="h-10 w-full" aria-label="Brand">
									<SelectValue placeholder="Pick a brand" />
								</SelectTrigger>
								<SelectContent className="max-h-80">
									{(brands ?? []).map((item) => (
										<SelectItem key={item.id} value={item.id}>
											<BrandOption brand={item} />
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</>
					)}
				</Field>
			</Section>

			<Section title="Sender" stagger={2}>
				<Field label="From name">
					<Input
						name="fromName"
						value={fromName}
						placeholder="Jane Doe"
						onChange={(event) => setFromName(event.target.value)}
					/>
				</Field>
				<Field label="From email" hint={senderHint?.text} isWarning={senderHint?.isWarning}>
					<Input
						name="fromEmail"
						type="email"
						value={fromEmail}
						required
						list="sending-domains"
						placeholder={sendingDomains?.[0] ? `hi@${sendingDomains[0].domain}` : "hi@mail.example.com"}
						onChange={(event) => setFromEmail(event.target.value)}
					/>
					<datalist id="sending-domains">
						{(sendingDomains ?? [])
							.filter(({ verified }) => verified)
							.map(({ domain }) => (
								<option key={domain} value={`${fromEmail.split("@")[0] || "hi"}@${domain}`} />
							))}
					</datalist>
				</Field>
				<Field label="Reply-to">
					<Input name="replyTo" type="email" defaultValue={newsletter?.replyTo} placeholder="Optional" />
				</Field>
				<Field label="Postal address" hint="Shown in the footer of every email. Anti-spam laws require one.">
					<Textarea
						name="postalAddress"
						defaultValue={newsletter?.postalAddress}
						required
						rows={2}
						placeholder="Company name, street, city, country"
					/>
				</Field>
			</Section>

			<Section
				title="Public archive"
				stagger={3}
				action={
					<div className="flex items-center gap-3">
						{newsletter?.archiveEnabled && (
							<a
								href={`/archive/${newsletter.slug}`}
								target="_blank"
								rel="noreferrer"
								className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
							>
								View
								<ExternalLink className="size-3" />
							</a>
						)}
						<Switch
							name="archiveEnabled"
							checked={isArchiveEnabled}
							onCheckedChange={setIsArchiveEnabled}
							aria-label="Public archive"
						/>
					</div>
				}
			>
				<p className="px-4 py-3 text-sm text-pretty text-muted-foreground">
					Sent issues get a page at /archive/{slug || "slug"}, with a signup form that adds readers to your
					list in Migma.
				</p>
				<Field label="Description" hint="One sentence under the name and in the subscribe popup">
					<Textarea
						name="description"
						defaultValue={newsletter?.description}
						rows={2}
						maxLength={MAX_DESCRIPTION_LENGTH}
						placeholder="One idea about building things, every Sunday."
					/>
				</Field>
				<Field label="Author bio" hint="Under your name on the author page">
					<Input
						name="authorBio"
						defaultValue={newsletter?.author?.bio}
						maxLength={MAX_AUTHOR_BIO_LENGTH}
						placeholder="I write about building small software companies."
					/>
				</Field>
				<Field label="Author photo" hint="An https:// link or a path like /authors/jane.jpg. The newsletter image otherwise.">
					<Input
						name="authorImageUrl"
						defaultValue={newsletter?.author?.imageUrl}
						placeholder="https://example.com/jane.jpg"
						className="font-mono"
					/>
				</Field>
				<Field label="Social links" hint="One link per line">
					<Textarea
						name="socialLinks"
						defaultValue={newsletter?.socialLinks?.join("\n")}
						rows={3}
						placeholder={"https://x.com/example\nhttps://youtube.com/@example"}
						className="font-mono text-[13px] leading-6"
					/>
				</Field>
			</Section>

			<div className="sticky bottom-0 -mx-4 mt-2 flex justify-end bg-background/80 px-4 py-3 backdrop-blur-md md:-mx-10 md:px-10">
				<Button type="submit" disabled={isPending} className="min-w-20">
					{isPending ? <Loader2 className="animate-spin" /> : newsletter ? "Save" : "Create"}
				</Button>
			</div>
		</form>
	);
}

// A Migma brand as people know it: its logo, its name and its website.
function BrandOption({ brand }) {
	return (
		<span className="flex min-w-0 items-center gap-2">
			{brand.logoUrl ? (
				// eslint-disable-next-line @next/next/no-img-element -- a 16px logo from Migma
				<img src={brand.logoUrl} alt="" width={16} height={16} className="size-4 shrink-0 rounded-sm object-contain" />
			) : (
				<span className="grid size-4 shrink-0 place-items-center rounded-sm bg-muted text-[10px] font-semibold text-muted-foreground">
					{brand.name.charAt(0).toUpperCase()}
				</span>
			)}
			<span className="truncate text-sm">{brand.name}</span>
			{brand.domain && <span className="truncate text-xs text-muted-foreground">{brand.domain}</span>}
		</span>
	);
}

function Section({ title, action, stagger, children }) {
	return (
		<section style={{ "--stagger": stagger }} className="rounded-xl bg-card shadow-border animate-enter">
			<div className="flex h-12 items-center justify-between gap-3 px-4">
				<h2 className="text-sm font-medium">{title}</h2>
				{action}
			</div>
			{children && <div className="divide-y divide-border/60 border-t border-border/60">{children}</div>}
		</section>
	);
}

// The from address has to be on a domain Migma can send from. Instant migma.email domains are for trying
// it out: Migma caps them at 50 recipients a day.
function getSenderHint(fromEmail, sendingDomains) {
	const domain = fromEmail.split("@")[1]?.trim().toLowerCase();
	if (!domain || !Array.isArray(sendingDomains)) return null;
	const match = sendingDomains.find((item) => item.domain === domain);
	if (!match) {
		return {
			isWarning: true,
			text: (
				<>
					{domain} isn&apos;t a sending domain in Migma yet.{" "}
					<Link href="/domains" className="underline underline-offset-2">
						Add it
					</Link>
				</>
			),
		};
	}
	if (!match.verified) return { isWarning: true, text: `${domain} is still being verified in Migma` };
	if (match.managed) return { isWarning: true, text: "Instant domain: up to 50 recipients a day. Add your own domain to send to your whole list." };
	return { text: `Verified in Migma` };
}

function Field({ label, hint, isWarning, children }) {
	return (
		<label className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
			<span className="text-sm text-muted-foreground sm:pt-2">{label}</span>
			<span className="flex flex-col gap-1.5">
				{children}
				{hint && (
					<span
						className={cn(
							"text-xs",
							isWarning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
						)}
					>
						{hint}
					</span>
				)}
			</span>
		</label>
	);
}
