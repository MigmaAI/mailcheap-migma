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

	function sendTest(event) {
		event.preventDefault();
		startTesting(async () => {
			if (!(await onBeforeTest())) return;
			const result = await sendTestCampaign(campaignId, to);
			if (result?.error) return toast.error(result.error);
			setIsOpen(false);
			toast.success(`Test sent to ${to.trim()}`);
			router.refresh();
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
							The email exactly as Migma will send it. The first test of each version takes up to a minute to prepare.
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
