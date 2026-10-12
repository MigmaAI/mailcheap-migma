"use client";

import { startTransition, useActionState, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveNewsletter } from "@/app/(app)/newsletters/actions";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import InfoTip from "@/components/InfoTip";
import PreviewEmail from "@/components/PreviewEmail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { MAX_AUTHOR_BIO_LENGTH, MAX_DESCRIPTION_LENGTH } from "@/lib/newsletters";
import { UNSUBSCRIBE_PLACEHOLDER, renderEmail } from "@/lib/render-email";
import { slugify } from "@/lib/slug";
import { cn } from "@/lib/utils";

const IMAGE_PREVIEW_PATTERN = /^(https:\/\/\S+\.\S{2,}\/\S+|\/\S+\.\w{3,4})$/;

// `suggested` (lib/newsletter-suggestions.js) fills a new newsletter in from what the account has.
export default function FormNewsletter({ newsletter, brands, sendingDomains, suggested }) {
	const [state, action, isPending] = useActionState(saveNewsletter, null);
	const [name, setName] = useState(newsletter?.name ?? suggested?.name ?? "");
	const [slug, setSlug] = useState(newsletter?.slug ?? slugify(suggested?.name ?? ""));
	const [isSlugEdited, setIsSlugEdited] = useState(Boolean(newsletter));
	const [fromName, setFromName] = useState(newsletter?.fromName ?? suggested?.fromName ?? "");
	const [fromEmail, setFromEmail] = useState(newsletter?.fromEmail ?? suggested?.fromEmail ?? "");
	const [postalAddress, setPostalAddress] = useState(newsletter?.postalAddress ?? suggested?.postalAddress ?? "");
	const [description, setDescription] = useState(newsletter?.description ?? "");
	const [imageUrl, setImageUrl] = useState(newsletter?.imageUrl ?? "");
	// The brand's logo arrives after the page has loaded (checkBrand, then a refresh). An empty field takes
	// it, so saving doesn't clear it; an image someone typed stays.
	const [savedImageUrl, setSavedImageUrl] = useState(newsletter?.imageUrl ?? "");
	if ((newsletter?.imageUrl ?? "") !== savedImageUrl) {
		setSavedImageUrl(newsletter?.imageUrl ?? "");
		if (!imageUrl) setImageUrl(newsletter?.imageUrl ?? "");
	}
	const [isArchiveEnabled, setIsArchiveEnabled] = useState(Boolean(newsletter?.archiveEnabled));
	// Brands a new newsletter can go on. One Migma is still reading works too: it finishes in the background.
	const pickableBrands = (brands ?? []).filter(({ failed }) => !failed);
	const suggestedBrandId = pickableBrands.some(({ id }) => id === suggested?.projectId) ? suggested.projectId : null;
	const [projectId, setProjectId] = useState(
		newsletter?.migma?.projectId ??
			suggestedBrandId ??
			(pickableBrands.find(({ importing }) => !importing) ?? pickableBrands[0])?.id ??
			""
	);
	// New newsletters start from the account's website; Migma customers can pick a brand they already have.
	// A suggested site with no brand yet starts from that website.
	const [brandSource, setBrandSource] = useState(
		pickableBrands.length > 0 && (suggestedBrandId || !suggested?.website) ? "existing" : "website"
	);

	useEffect(() => {
		if (state?.ok) toast.success("Saved");
		if (state?.error) toast.error(state.error);
	}, [state]);

	const brand = brands?.find(({ id }) => id === projectId);
	const isFromWebsite = !newsletter && brandSource === "website";
	// A new newsletter without its own image takes its brand's logo (newsletters/actions.js).
	const previewImageUrl =
		IMAGE_PREVIEW_PATTERN.test(imageUrl) ? imageUrl : !newsletter && !isFromWebsite ? (brand?.logoUrl ?? "") : "";
	const senderHint = getSenderHint(fromEmail, sendingDomains);

	// The real email template with a sample issue, so the preview is what readers get.
	const previewValues = useDeferredValue({ name, fromName, fromEmail, postalAddress, description });
	const preview = useMemo(() => {
		const title = previewValues.name.trim() || "Your newsletter";
		const subject = `Welcome to ${title}`;
		const { html } = renderEmail({
			markdown: sampleIssue({ ...previewValues, title }),
			subject,
			previewText: previewValues.description.trim(),
			// An empty address still shows where it goes.
			newsletter: { name: title, postalAddress: previewValues.postalAddress.trim() || "Your postal address" },
		});
		return { subject, html: html.replaceAll(UNSUBSCRIBE_PLACEHOLDER, "#") };
	}, [previewValues]);

	return (
		<form
			// Not action={action}: React clears a form's fields after an action, so an error (a slug taken,
			// a website Migma refused) would wipe what was typed.
			onSubmit={(event) => {
				event.preventDefault();
				const formData = new FormData(event.currentTarget);
				startTransition(() => action(formData));
			}}
			className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start"
		>
			<div className="flex min-w-0 flex-col gap-4">
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
						info={
							isFromWebsite && !imageUrl
								? "A square logo, 128×128 or larger. Leave it empty to use your website's logo."
								: !newsletter && brand?.logoUrl && !imageUrl
									? `A square logo, 128×128 or larger. Leave it empty to use ${brand.name}'s logo.`
									: "A square logo, 128×128 or larger."
						}
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

				<Section title="Brand" stagger={1}>
					{newsletter ? (
						<Field label="Brand" info="Subscribers are contacts on this brand in Migma, on this newsletter's own list.">
							<span className="flex h-9 items-center">{brand ? <BrandOption brand={brand} /> : "Brand in Migma"}</span>
						</Field>
					) : isFromWebsite ? (
						<Field
							label="Website"
							info="Migma reads it for your logo, colors and fonts, and designs your issues with them. It's saved as a brand in your Migma account."
							hint={
								pickableBrands.length > 0 && (
									<SwitchBrandSource onClick={() => setBrandSource("existing")}>Use a brand I have in Migma</SwitchBrandSource>
								)
							}
						>
							<input type="hidden" name="brandSource" value="website" />
							<Input
								name="website"
								required
								defaultValue={suggested?.website}
								placeholder="yourcompany.com"
								inputMode="url"
								autoComplete="url"
								spellCheck={false}
							/>
						</Field>
					) : (
						<Field
							label="Brand"
							info="Its colors and logo shape the emails Migma designs. Subscribers become contacts on this brand."
							hint={<SwitchBrandSource onClick={() => setBrandSource("website")}>Start from a website instead</SwitchBrandSource>}
						>
							<input type="hidden" name="brandSource" value="existing" />
							<input type="hidden" name="projectId" value={projectId} />
							{/* Radix reports "" while the value isn't in the list; nobody can pick "" themselves. */}
							<Select value={projectId} onValueChange={(value) => value && setProjectId(value)}>
								<SelectTrigger className="h-10 w-full" aria-label="Brand">
									<SelectValue placeholder="Pick a brand" />
								</SelectTrigger>
								<SelectContent className="max-h-80">
									{pickableBrands.map((item) => (
										<SelectItem key={item.id} value={item.id}>
											<BrandOption brand={item} />
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					)}
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
						<Input name="replyTo" type="email" defaultValue={newsletter?.replyTo ?? suggested?.replyTo} placeholder="Optional" />
					</Field>
					<Field label="Postal address" info="Shown in the footer of every email. Anti-spam laws require one.">
						<Textarea
							name="postalAddress"
							value={postalAddress}
							onChange={(event) => setPostalAddress(event.target.value)}
							required
							rows={2}
							placeholder="Company name, street, city, country"
						/>
					</Field>
				</Section>

				<Section
					title="Public archive"
					info={`Sent issues get a page at /archive/${slug || "slug"}, with a signup form that adds readers to your list in Migma.`}
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
					<Field label="Description" info="One sentence under the name and in the subscribe popup.">
						<Textarea
							name="description"
							value={description}
							onChange={(event) => setDescription(event.target.value)}
							rows={2}
							maxLength={MAX_DESCRIPTION_LENGTH}
							placeholder="One idea about building things, every Sunday."
						/>
					</Field>
					<Field label="Author bio" info="Under your name on the author page.">
						<Input
							name="authorBio"
							defaultValue={newsletter?.author?.bio}
							maxLength={MAX_AUTHOR_BIO_LENGTH}
							placeholder="I write about building small software companies."
						/>
					</Field>
					<Field label="Author photo" info="An https:// link or a path like /authors/jane.jpg. Empty uses the newsletter image.">
						<Input
							name="authorImageUrl"
							defaultValue={newsletter?.author?.imageUrl}
							placeholder="https://example.com/jane.jpg"
							className="font-mono"
						/>
					</Field>
					<Field label="Social links" info="One link per line.">
						<Textarea
							name="socialLinks"
							defaultValue={newsletter?.socialLinks?.join("\n")}
							rows={3}
							placeholder={"https://x.com/example\nhttps://youtube.com/@example"}
							className="font-mono text-[13px] leading-6"
						/>
					</Field>
				</Section>

				<div className="sticky bottom-0 mt-2 flex justify-end bg-background/80 py-3 backdrop-blur-md">
					<Button type="submit" disabled={isPending} className="min-w-20">
						{isPending ? <Loader2 className="animate-spin" /> : newsletter ? "Save" : "Create"}
					</Button>
				</div>
			</div>

			<aside aria-label="Preview" className="min-w-0 xl:sticky xl:top-6">
				<PreviewEmail
					// Empty fields show what goes there, not a blank sender.
					sender={{
						name: name.trim() || "Your newsletter",
						fromName: fromName.trim() || name.trim() || "Your name",
						fromEmail: fromEmail.trim() || "you@yourdomain.com",
						imageUrl: previewImageUrl,
					}}
					subject={preview.subject}
					previewText={description.trim()}
					html={preview.html}
					toolbar={
						<span className="flex items-center gap-1.5 text-xs text-muted-foreground">
							Preview
							<InfoTip label="About the preview" side="left">
								How a reader sees an issue. Your sender, footer and address are real; the words are placeholders.
							</InfoTip>
						</span>
					}
					className="h-[780px] lg:h-[720px] xl:h-[calc(100dvh-5rem)] xl:max-h-[860px]"
				/>
			</aside>
		</form>
	);
}

// Placeholder words for the preview, shaped like a real issue: a title, a list, a sign-off.
function sampleIssue({ title, description, fromName }) {
	return [
		`# Welcome to ${title}`,
		description.trim() || "Thanks for subscribing. Here is what to expect from each issue.",
		"## In this issue",
		"- One idea worth your time\n- What changed since last time\n- A link worth reading",
		`See you next time,  \n${fromName.trim() || title}`,
	].join("\n\n");
}

// Inside a field's hint, which sits in its <label>: a button there doesn't focus the field.
function SwitchBrandSource({ onClick, children }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="w-fit text-muted-foreground underline decoration-border underline-offset-2 transition-colors duration-150 hover:text-foreground hover:decoration-foreground"
		>
			{children}
		</button>
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
			{brand.importing || brand.failed ? (
				<span className="shrink-0 text-xs text-muted-foreground">{brand.failed ? "Not set up" : "Still importing"}</span>
			) : (
				brand.domain && <span className="truncate text-xs text-muted-foreground">{brand.domain}</span>
			)}
		</span>
	);
}

function Section({ title, info, action, stagger, children }) {
	return (
		<section style={{ "--stagger": stagger }} className="rounded-xl bg-card shadow-border animate-enter">
			<div className="flex h-12 items-center justify-between gap-3 px-4">
				<h2 className="flex items-center gap-1.5 text-sm font-medium">
					{title}
					{info && <InfoTip label={`About ${title.toLowerCase()}`}>{info}</InfoTip>}
				</h2>
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
	return null;
}

// `info` is the optional explanation, behind a tooltip; `hint` stays on the page (warnings, actions).
function Field({ label, info, hint, isWarning, children }) {
	return (
		<label className="grid gap-2 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-4">
			<span className="flex items-center gap-1.5 self-start text-sm text-muted-foreground sm:h-9">
				{label}
				{info && <InfoTip label={`About ${label.toLowerCase()}`}>{info}</InfoTip>}
			</span>
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
