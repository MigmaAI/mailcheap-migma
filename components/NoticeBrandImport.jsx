"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkBrand, retryBrand } from "@/app/(app)/newsletters/actions";
import InfoTip from "@/components/InfoTip";
import { Button } from "@/components/ui/button";

const POLL_MS = 3000;
// Migma's own clients wait about six minutes for an import.
const MAX_WAIT_MS = 6 * 60 * 1000;
const PROGRESS = { pending: "10%", processing: "60%" };

// A newsletter whose brand Migma is still reading from its website (or couldn't read). Writing and
// contacts work meanwhile; Migma sends, tests and designs once the brand is ready.
export default function NoticeBrandImport({ newsletterId, site, isFailed }) {
	const router = useRouter();
	const [result, setResult] = useState({ status: isFailed ? "error" : "pending" });
	const [round, setRound] = useState(0);
	const [isRetrying, setIsRetrying] = useState(false);

	useEffect(() => {
		if (isFailed && round === 0) return;
		let isActive = true;
		let timer;
		const startedAt = Date.now();
		async function poll() {
			const next = await checkBrand(newsletterId);
			if (!isActive) return;
			if (next.status === "active") {
				toast.success("Your brand is ready");
				return router.refresh();
			}
			if (next.status === "error") {
				setResult(next);
				// The brand row below shows the failure too.
				return router.refresh();
			}
			if (Date.now() - startedAt > MAX_WAIT_MS) return setResult({ status: "slow" });
			// A check Migma didn't answer keeps the last known step.
			if (next.status !== "unknown") setResult(next);
			timer = setTimeout(poll, POLL_MS);
		}
		timer = setTimeout(poll, round === 0 ? 1000 : POLL_MS);
		return () => {
			isActive = false;
			clearTimeout(timer);
		};
	}, [newsletterId, isFailed, round, router]);

	function checkAgain() {
		setResult({ status: "pending" });
		setRound((value) => value + 1);
	}

	async function retry() {
		setIsRetrying(true);
		const response = await retryBrand(newsletterId);
		setIsRetrying(false);
		if (response?.error) return toast.error(response.error);
		checkAgain();
	}

	if (result.status === "error") {
		return (
			<div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-card py-2.5 pr-2.5 pl-4 shadow-border">
				<p className="flex min-w-0 items-center gap-2 text-sm">
					<CircleAlert className="size-4 shrink-0 text-destructive" />
					<span className="truncate">Migma couldn&apos;t read {site}</span>
					<InfoTip label="Why this matters">
						{result.error ? `${result.error.replace(/\.$/, "")}. ` : ""}Sending and Design with Migma need your brand.
					</InfoTip>
				</p>
				<Button type="button" variant="outline" size="sm" onClick={retry} disabled={isRetrying}>
					{isRetrying ? <Loader2 className="animate-spin" /> : "Try again"}
				</Button>
			</div>
		);
	}

	const isSlow = result.status === "slow";
	return (
		<div aria-live="polite" className="flex flex-col gap-2.5 rounded-xl bg-card px-4 py-3 shadow-border">
			<div className="flex items-center justify-between gap-3">
				<p className="flex min-w-0 items-center gap-2 text-sm">
					{!isSlow && <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />}
					<span className="truncate">{isSlow ? `Still reading ${site}` : `Setting up your brand from ${site}`}</span>
					<InfoTip label="About your brand">
						{isSlow
							? "Some sites take longer. Your brand finishes in the background."
							: "Migma is picking up your logo, colors and fonts, usually in about a minute. Write and add contacts now; sending and Design with Migma start once it's done."}
					</InfoTip>
				</p>
				{isSlow && (
					<Button type="button" variant="outline" size="sm" onClick={checkAgain}>
						Check again
					</Button>
				)}
			</div>
			{!isSlow && (
				<div className="h-1 overflow-hidden rounded-full bg-muted">
					<div
						className="h-full rounded-full bg-foreground/70 transition-[width] duration-700 ease-out motion-reduce:transition-none"
						style={{ width: PROGRESS[result.status] ?? "10%" }}
					/>
				</div>
			)}
		</div>
	);
}
