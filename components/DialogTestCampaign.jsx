"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { sendTestCampaign } from "@/app/(app)/campaigns/actions";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// The test is the email exactly as Migma will send it, so it's the last look before sending.
export default function DialogTestCampaign({ campaignId, testEmail, disabledReason, onBeforeTest }) {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [to, setTo] = useState(testEmail ?? "");
	const [isTesting, startTesting] = useTransition();
	// Migma prepares the first test of each version, which can take a minute: say so instead of only spinning.
	const [isPreparing, setIsPreparing] = useState(false);

	function sendTest(event) {
		event.preventDefault();
		startTesting(async () => {
			const preparingTimer = setTimeout(() => setIsPreparing(true), 3000);
			try {
				if (!(await onBeforeTest())) return;
				const result = await sendTestCampaign(campaignId, to);
				if (result?.error) return toast.error(result.error);
				setIsOpen(false);
				toast.success(`Test sent to ${to.trim()}`);
				router.refresh();
			} catch {
				// A dropped connection rejects the action; without this the button would spin forever.
				toast.error("Couldn't reach Mailcheap. Check your connection and try again.");
			} finally {
				clearTimeout(preparingTimer);
				setIsPreparing(false);
			}
		});
	}

	if (disabledReason) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<span tabIndex={0} className="rounded-lg">
						<Button variant="outline" disabled>
							<FlaskConical data-icon="inline-start" />
							Test
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>{disabledReason}</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !isTesting && setIsOpen(open)}>
			<DialogTrigger asChild>
				<Button variant="outline">
					<FlaskConical data-icon="inline-start" />
					Test
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-sm">
				<form onSubmit={sendTest} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>Send a test</DialogTitle>
						<DialogDescription>
							The email exactly as Migma will send it.
						</DialogDescription>
					</DialogHeader>
					<Input
						type="email"
						value={to}
						onChange={(event) => setTo(event.target.value)}
						placeholder="you@example.com"
						autoComplete="email"
						required
						autoFocus
						aria-label="Send the test to"
					/>
					{isPreparing && (
						<p aria-live="polite" className="-mt-1 text-xs text-muted-foreground">
							Migma is preparing this version of the email. It can take a minute.
						</p>
					)}
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline" disabled={isTesting}>
								Cancel
							</Button>
						</DialogClose>
						<Button type="submit" disabled={isTesting} className="min-w-24">
							{isTesting ? <Loader2 className="animate-spin" /> : "Send test"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
