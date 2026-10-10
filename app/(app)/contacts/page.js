import crypto from "node:crypto";
import { Suspense } from "react";
import Link from "next/link";
import { isValidObjectId } from "mongoose";
import { ChevronLeft, ChevronRight, TriangleAlert, Users } from "lucide-react";
import AvatarContact from "@/components/AvatarContact";
import BadgeStatus from "@/components/BadgeStatus";
import DialogImportContacts from "@/components/DialogImportContacts";
import FilterContacts from "@/components/FilterContacts";
import HeaderPage from "@/components/HeaderPage";
import MenuContact from "@/components/MenuContact";
import StateEmpty from "@/components/StateEmpty";
import TextEmpty from "@/components/TextEmpty";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { requireMigma } from "@/lib/auth";
import { CONTACT_STATUSES, CONTACT_STATUS_LABELS, listContacts } from "@/lib/contacts";
import { formatDate, formatNumber } from "@/lib/format";
import { NEWSLETTER_SUMMARY_FIELDS, toNewsletterOptions } from "@/lib/newsletters";
import { cn } from "@/lib/utils";
import Newsletter from "@/models/Newsletter";

export const metadata = { title: "Contacts" };

const PAGE_SIZE = 50;

// Contacts live in Migma: one newsletter's list at a time, read straight from it.
export default async function ContactsPage({ searchParams }) {
	const params = await searchParams;
	const status = CONTACT_STATUSES.includes(params.status) ? params.status : null;
	const query = typeof params.q === "string" ? params.q.trim().toLowerCase().slice(0, 254) : "";
	const page = Math.max(1, Number.parseInt(params.page, 10) || 1);

	const { accountId, migma } = await requireMigma();
	const newsletters = await Newsletter.find({ accountId }).sort({ createdAt: 1 }).select(`${NEWSLETTER_SUMMARY_FIELDS} migma`).lean();
	const newsletter =
		newsletters.find(({ _id }) => isValidObjectId(params.newsletter) && _id.toString() === params.newsletter) ?? newsletters[0];
	const newsletterOptions = toNewsletterOptions(newsletters);

	if (!newsletter) {
		return (
			<>
				<HeaderPage title="Contacts" />
				<StateEmpty icon={Users} title="No newsletters yet">
					<Button asChild variant="outline" size="sm">
						<Link href="/newsletters/new">Create a newsletter</Link>
					</Button>
				</StateEmpty>
			</>
		);
	}
	const newsletterId = newsletter._id.toString();

	let result;
	try {
		result = await listContacts(migma, newsletter, { status, search: query, page, limit: PAGE_SIZE });
	} catch (error) {
		result = { contacts: [], total: 0, error: error.message };
	}
	const { contacts, total } = result;
	const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

	function href(changes) {
		const next = new URLSearchParams(
			Object.entries({ newsletter: newsletterId, status, q: query, page }).filter(([, value]) => value)
		);
		for (const [key, value] of Object.entries(changes)) {
			if (value) next.set(key, value);
			else next.delete(key);
		}
		if (next.get("page") === "1") next.delete("page");
		return `/contacts${next.size ? `?${next}` : ""}`;
	}

	return (
		<>
			<HeaderPage title="Contacts">
				<DialogImportContacts newsletters={newsletterOptions} defaultNewsletterId={newsletterId} />
			</HeaderPage>

			<div className="flex flex-col gap-4">
				<Suspense fallback={<Skeleton className="h-9 w-full rounded-lg" />}>
					<FilterContacts newsletters={newsletterOptions} selectedId={newsletterId} />
				</Suspense>

				<nav
					aria-label="Status"
					className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 animate-enter [scrollbar-width:none]"
				>
					{[null, ...CONTACT_STATUSES].map((key) => {
						const isActive = key === status;
						return (
							<Link
								key={key ?? "all"}
								href={href({ status: key, page: null })}
								scroll={false}
								aria-current={isActive ? "page" : undefined}
								className={cn(
									"inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-sm transition-[color,background-color,box-shadow] duration-150",
									isActive
										? "bg-foreground text-background"
										: "text-muted-foreground hover:bg-muted hover:text-foreground"
								)}
							>
								{key ? CONTACT_STATUS_LABELS[key] : "All"}
								{isActive && <span className="text-xs tabular-nums opacity-70">{formatNumber(total)}</span>}
							</Link>
						);
					})}
				</nav>

				{result.error ? (
					<StateEmpty icon={TriangleAlert} title="Couldn't load contacts from Migma">
						<p className="max-w-md text-sm text-muted-foreground">{result.error}</p>
					</StateEmpty>
				) : contacts.length === 0 ? (
					<StateEmpty icon={Users} title={status || query ? "No contacts match" : "No contacts yet"} />
				) : (
					<div style={{ "--stagger": 1 }} className="overflow-hidden rounded-xl shadow-border animate-enter">
						<Table>
							<TableHeader>
								<TableRow className="hover:bg-transparent">
									<TableHead className="pl-4">Email</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="hidden text-right sm:table-cell">Added</TableHead>
									<TableHead className="w-12 pr-2" />
								</TableRow>
							</TableHeader>
							<TableBody>
								{contacts.map((contact) => (
									<TableRow key={contact.id} className="tabular-nums">
										<TableCell className="max-w-0 py-2.5 pl-4 font-medium sm:w-3/5">
											<span className="flex min-w-0 items-center gap-2.5">
												<AvatarContact
													email={contact.email}
													gravatarHash={gravatarHash(contact.email)}
													size={26}
												/>
												<span className="truncate">{contact.email}</span>
											</span>
										</TableCell>
										<TableCell>
											<BadgeStatus status={contact.status} label={CONTACT_STATUS_LABELS[contact.status]} />
										</TableCell>
										<TableCell className="hidden text-right text-muted-foreground sm:table-cell">
											{formatDate(contact.createdAt) ?? <TextEmpty />}
										</TableCell>
										<TableCell className="pr-2 text-right">
											<MenuContact newsletterId={newsletterId} email={contact.email} status={contact.status} />
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
				)}

				{pageCount > 1 && (
					<div className="flex items-center justify-between gap-3 text-sm text-muted-foreground tabular-nums">
						<span>
							{formatNumber((page - 1) * PAGE_SIZE + 1)}–{formatNumber(Math.min(page * PAGE_SIZE, total))} of{" "}
							{formatNumber(total)}
						</span>
						<div className="flex gap-1">
							<PageLink href={href({ page: page - 1 })} isDisabled={page <= 1} label="Previous">
								<ChevronLeft />
							</PageLink>
							<PageLink href={href({ page: page + 1 })} isDisabled={page >= pageCount} label="Next">
								<ChevronRight />
							</PageLink>
						</div>
					</div>
				)}
			</div>
		</>
	);
}

function PageLink({ href, isDisabled, label, children }) {
	if (isDisabled) {
		return (
			<Button variant="outline" size="icon" disabled aria-label={label}>
				{children}
			</Button>
		);
	}
	return (
		<Button asChild variant="outline" size="icon">
			<Link href={href} scroll={false} aria-label={label}>
				{children}
			</Link>
		</Button>
	);
}

function gravatarHash(email) {
	return crypto.createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}
