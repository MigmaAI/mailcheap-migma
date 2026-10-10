import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import BadgeStatus from "@/components/BadgeStatus";
import TextEmpty from "@/components/TextEmpty";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const FILTERS = [
	{ key: null, label: "All" },
	{ key: "delivered", label: "Delivered" },
	{ key: "opened", label: "Opened" },
	{ key: "clicked", label: "Clicked" },
	{ key: "bounced", label: "Bounced" },
];
const STATUS_LABELS = { complained: "Spam report", suppressed: "Skipped", sent: "Sent" };

function href(base, changes) {
	const params = new URLSearchParams(Object.entries(changes).filter(([, value]) => value));
	return `${base}${params.size ? `?${params}` : ""}#recipients`;
}

// Who got the issue and what they did, page by page from Migma's delivery log.
export default function TableRecipients({ base, recipients, filter, cursor, error }) {
	const rows = recipients?.emails ?? [];
	return (
		<section id="recipients" className="flex scroll-mt-6 flex-col gap-3">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-sm font-medium text-muted-foreground">Recipients</h2>
				<nav aria-label="Filter recipients" className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
					{FILTERS.map(({ key, label }) => {
						const isActive = (filter ?? null) === key;
						return (
							<Link
								key={label}
								href={href(base, { recipients: key })}
								scroll={false}
								aria-current={isActive ? "page" : undefined}
								className={cn(
									"inline-flex h-7 shrink-0 items-center rounded-full px-3 text-xs transition-colors duration-150",
									isActive ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"
								)}
							>
								{label}
							</Link>
						);
					})}
				</nav>
			</div>

			{error ? (
				<p className="rounded-xl px-4 py-6 text-center text-sm text-muted-foreground shadow-border">
					Migma couldn&apos;t list recipients right now. {error}
				</p>
			) : rows.length === 0 ? (
				<p className="flex items-center justify-center gap-2 rounded-xl px-4 py-6 text-sm text-muted-foreground shadow-border">
					<Users className="size-4" />
					{filter ? "Nobody here yet" : "Recipients show up as Migma sends"}
				</p>
			) : (
				<div className="overflow-hidden rounded-xl shadow-border">
					<Table>
						<TableHeader>
							<TableRow className="hover:bg-transparent">
								<TableHead className="pl-4">Email</TableHead>
								<TableHead>Status</TableHead>
								<TableHead className="hidden text-right sm:table-cell">Opens</TableHead>
								<TableHead className="hidden text-right sm:table-cell">Clicks</TableHead>
								<TableHead className="pr-4 text-right">Sent</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{rows.map((row) => (
								<TableRow key={`${row.to_email}-${row.created_at}`} className="tabular-nums">
									<TableCell className="max-w-0 py-2.5 pl-4 sm:w-2/5">
										<span className="block truncate font-medium">{row.to_email}</span>
										{(row.bounce_type || row.complaint_type || row.suppression_reason) && (
											<span className="block truncate text-xs text-muted-foreground">
												{row.bounce_type ? `${row.bounce_type} bounce` : row.complaint_type || row.suppression_reason}
											</span>
										)}
									</TableCell>
									<TableCell>
										<BadgeStatus status={row.status} label={STATUS_LABELS[row.status]} />
									</TableCell>
									<TableCell className="hidden text-right sm:table-cell">
										{row.open_count ? formatNumber(row.open_count) : <TextEmpty />}
									</TableCell>
									<TableCell className="hidden text-right sm:table-cell">
										{row.click_count ? formatNumber(row.click_count) : <TextEmpty />}
									</TableCell>
									<TableCell className="pr-4 text-right text-muted-foreground">{formatRelative(row.created_at)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}

			{(cursor || recipients?.hasMore) && (
				<div className="flex justify-end gap-2">
					{cursor && (
						<Button asChild variant="outline" size="sm">
							<Link href={href(base, { recipients: filter })} scroll={false}>
								First page
							</Link>
						</Button>
					)}
					{recipients?.hasMore && recipients.nextCursor && (
						<Button asChild variant="outline" size="sm">
							<Link href={href(base, { recipients: filter, cursor: recipients.nextCursor })} scroll={false}>
								Next
								<ChevronRight data-icon="inline-end" />
							</Link>
						</Button>
					)}
				</div>
			)}
		</section>
	);
}
