"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { sendCampaign } from "@/app/(app)/campaigns/actions";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCount, formatSendTime } from "@/lib/format";

const STARTED_MESSAGES = {
	review: "Migma is giving it a quick check before it goes out",
	sent: "Sent",
};

export default function DialogSendCampaign({ campaignId, audienceCount, scheduledAt, blockingMessage, onBeforeSend }) {
	const router = useRouter();
	const [isOpen, setIsOpen] = useState(false);
	const [isSending, startSending] = useTransition();

	function send() {
		startSending(async () => {
			try {
				if (!(await onBeforeSend())) return;
				const result = await sendCampaign(campaignId);
				if (result?.error) return toast.error(result.error);
				setIsOpen(false);
				toast.success(STARTED_MESSAGES[result?.status] ?? "Sending started");
				router.refresh();
			} catch {
				// A dropped connection rejects the action; the campaign page shows whether it went out.
				toast.error("Couldn't reach Mailcheap. Refresh to see whether it went out.");
			}
		});
	}

	// Nobody to send to yet: the button explains instead of opening "Send to 0 subscribers?".
	const disabledMessage = blockingMessage ?? (audienceCount === 0 ? "No subscribers yet. Add contacts first." : null);

	if (disabledMessage) {
		return (
			<Tooltip>
				<TooltipTrigger asChild>
					<span tabIndex={0} className="rounded-lg">
						<Button disabled>
							<Send data-icon="inline-start" />
							Send
						</Button>
					</span>
				</TooltipTrigger>
				<TooltipContent>{disabledMessage}</TooltipContent>
			</Tooltip>
		);
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !isSending && setIsOpen(open)}>
			<DialogTrigger asChild>
				<Button>
					<Send data-icon="inline-start" />
					Send
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-sm">
				<DialogHeader>
					<DialogTitle className="tabular-nums">
						{audienceCount === null ? "Send to your subscribers?" : `Send to ${formatCount(audienceCount, "subscriber")}?`}
					</DialogTitle>
					<DialogDescription>
						{scheduledAt ? `It goes out now instead of ${formatSendTime(scheduledAt)}. ` : ""}
						Migma prepares the email, then sends it and skips anyone who unsubscribed or bounced.
					</DialogDescription>
				</DialogHeader>
				{isSending && (
					<p aria-live="polite" className="text-sm text-muted-foreground">
						Preparing in Migma, this can take a minute…
					</p>
				)}
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline" disabled={isSending}>
							Cancel
						</Button>
					</DialogClose>
					<Button onClick={send} disabled={isSending} className="min-w-20">
						{isSending ? <Loader2 className="animate-spin" /> : "Send"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
