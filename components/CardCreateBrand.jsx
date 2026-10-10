"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { checkBrand, createBrand, retryBrand } from "@/app/(app)/newsletters/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const POLL_MS = 3000;
// Migma's own clients wait about six minutes for an import.
const MAX_WAIT_MS = 6 * 60 * 1000;
const PROGRESS = { pending: "10%", processing: "60%" };

// A Migma brand from the account's website: its name, logo, colors and fonts. The page shows the new
// brand when Migma is done (router.refresh); `importing` resumes a brand Migma is still reading.
export default function CardCreateBrand({ importing, onReady, onCancel, isCompact }) {
	const [state, action, isPending] = useActionState(createBrand, null);
	const [website, setWebsite] = useState("");
	const [dismissedId, setDismissedId] = useState(null);
	const started = state?.projectId
		? { projectId: state.projectId, website: state.website }
		: importing && { projectId: importing.id, website: importing.domain || importing.name };
	const job = started && started.projectId !== dismissedId ? started : null;

	// No <form>: the compact card sits inside the newsletter form, and forms can't nest.
	function submit() {
		if (isPending || !website.trim()) return;
		const formData = new FormData();
		formData.set("website", website);
		startTransition(() => action(formData));
	}

	const body = job ? (
		<BrandImport
			key={job.projectId}
			projectId={job.projectId}
			website={job.website}
			onReady={onReady}
			onDismiss={() => setDismissedId(job.projectId)}
		/>
	) : (
		<div className="flex flex-col gap-2">
			<div className="flex flex-col gap-2 sm:flex-row">
				<Input
					value={website}
					onChange={(event) => setWebsite(event.target.value)}
					onKeyDown={(event) => {
						if (event.key !== "Enter") return;
						event.preventDefault();
						submit();
					}}
					placeholder="yourcompany.com"
					aria-label="Your website"
					inputMode="url"
					autoComplete="url"
					spellCheck={false}
					autoFocus={isCompact}
					className="h-10"
				/>
				<Button type="button" onClick={submit} disabled={isPending || !website.trim()} className="h-10 min-w-32">
					{isPending ? <Loader2 className="animate-spin" /> : "Create brand"}
				</Button>
				{onCancel && (
					<Button type="button" variant="ghost" onClick={onCancel} className="h-10">
						Cancel
					</Button>
				)}
			</div>
			{state?.error && (
				<p role="alert" className="text-sm text-destructive">
					{state.error}
				</p>
			)}
		</div>
	);

	if (isCompact) return body;
	return (
		<section className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-border animate-enter">
			<div className="flex flex-col gap-1">
				<h2 className="font-medium">Create your brand</h2>
				<p className="text-sm text-pretty text-muted-foreground">
					A newsletter lives on a Migma brand. Enter your website and Migma picks up your name, logo, colors and
					fonts, so the emails it designs look like yours.
				</p>
			</div>
			{body}
			<p className="text-xs text-muted-foreground">The brand is saved in your Migma account, where you can edit it.</p>
		</section>
	);
}

function BrandImport({ projectId, website, onReady, onDismiss }) {
	const router = useRouter();
	const [result, setResult] = useState({ status: "pending" });
	const [round, setRound] = useState(0);
	const [isRetrying, setIsRetrying] = useState(false);

	useEffect(() => {
		let isActive = true;
		let timer;
		const startedAt = Date.now();
		async function poll() {
			const next = await checkBrand(projectId);
			if (!isActive) return;
			if (next.status === "active") {
				toast.success(`${next.name || website} is ready`);
				onReady?.(projectId);
				return router.refresh();
			}
			if (next.status === "error") return setResult(next);
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
	}, [projectId, website, round, onReady, router]);

	function checkAgain() {
		setResult({ status: "pending" });
		setRound((value) => value + 1);
	}

	async function retry() {
		setIsRetrying(true);
		const response = await retryBrand(projectId);
		setIsRetrying(false);
		if (response?.error) return toast.error(response.error);
		checkAgain();
	}

	if (result.status === "error") {
		return (
			<div role="alert" className="flex flex-col gap-3">
				<p className="flex items-start gap-2 text-sm">
					<CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
					<span>
						<span className="font-medium">Migma couldn&apos;t read {website}.</span>{" "}
						<span className="text-muted-foreground">{result.error || "Check the address and try again."}</span>
					</span>
				</p>
				<div className="flex gap-2">
					<Button type="button" variant="outline" size="sm" onClick={retry} disabled={isRetrying}>
						{isRetrying ? <Loader2 className="animate-spin" /> : "Try again"}
					</Button>
					<Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
						Use another website
					</Button>
				</div>
			</div>
		);
	}

	const isSlow = result.status === "slow";
	return (
		<div aria-live="polite" className="flex flex-col gap-2.5">
			<p className="flex items-center gap-2 text-sm font-medium">
				{!isSlow && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
				{isSlow ? `Migma is still reading ${website}` : `Creating ${result.name || website}`}
			</p>
			<p className="text-sm text-pretty text-muted-foreground">
				{isSlow
					? "Some sites take longer. The brand shows up here when it's done; you can leave this page."
					: "Migma is reading the site for your logo, colors and fonts. Usually about a minute."}
			</p>
			{isSlow ? (
				<div>
					<Button type="button" variant="outline" size="sm" onClick={checkAgain}>
						Check again
					</Button>
				</div>
			) : (
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
