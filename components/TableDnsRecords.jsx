import ButtonCopy from "@/components/ButtonCopy";
import { cn } from "@/lib/utils";

const RECORD_TONES = { verified: "bg-emerald-500", pending: "bg-amber-500", failed: "bg-red-500" };
const RECORD_LABELS = { verified: "Found", pending: "Not found yet", failed: "Wrong value" };

// Each record with what Migma last saw for it, so it's clear which one is missing.
export default function TableDnsRecords({ records }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm">
				<tbody className="divide-y divide-border/60">
					{records.map((record) => (
						<tr key={`${record.type}-${record.name}-${record.value}`}>
							<td className="w-8 py-2.5 pl-4 align-middle">
								<span
									title={RECORD_LABELS[record.status] ?? "Not checked"}
									className={cn("block size-1.5 rounded-full", RECORD_TONES[record.status] ?? "bg-zinc-300 dark:bg-zinc-600")}
								>
									<span className="sr-only">{RECORD_LABELS[record.status] ?? "Not checked"}</span>
								</span>
							</td>
							<td className="w-14 py-2.5 align-middle font-mono text-xs text-muted-foreground">
								{record.type}
								{record.priority !== null && <span className="ml-1 opacity-70">{record.priority}</span>}
							</td>
							<td className="max-w-0 py-2.5 pr-2 align-middle">
								<div className="flex items-center gap-1">
									<span className="truncate font-mono text-xs">{record.name}</span>
									<ButtonCopy value={record.name} label="Copy name" />
								</div>
							</td>
							<td className="max-w-0 py-2.5 pr-4 align-middle">
								<div className="flex items-center gap-1">
									<span className="truncate font-mono text-xs">{record.value}</span>
									<ButtonCopy value={record.value} label="Copy value" />
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
