"use client";

import { useState, useTransition } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createDesignedCampaign } from "@/app/(app)/campaigns/actions";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

// Opened from the New menu, so the caller owns the open state.
export default function DialogDesignCampaign({ newsletters, isOpen, onOpenChange }) {
	const [newsletterId, setNewsletterId] = useState(newsletters[0]?.id ?? "");
	const [prompt, setPrompt] = useState("");
	const [isStarting, startStarting] = useTransition();

	function design() {
		startStarting(async () => {
			const result = await createDesignedCampaign(newsletterId, prompt);
			if (result?.error) toast.error(result.error);
		});
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !isStarting && onOpenChange(open)}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Design with Migma</DialogTitle>
					<DialogDescription>
						Say what this issue is about. Migma writes and designs it on your brand; you review it before anything
						is sent.
					</DialogDescription>
				</DialogHeader>
				{newsletters.length > 1 && (
					<select
						value={newsletterId}
						onChange={(event) => setNewsletterId(event.target.value)}
						aria-label="Newsletter"
						className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
					>
						{newsletters.map(({ id, name }) => (
							<option key={id} value={id}>
								{name}
							</option>
						))}
					</select>
				)}
				<Textarea
					value={prompt}
					onChange={(event) => setPrompt(event.target.value)}
					rows={6}
					maxLength={4000}
					autoFocus
					aria-label="What this issue is about"
					placeholder={"This week: we shipped dark mode, 3 tips for faster exports, and a reader question about pricing. Link: https://example.com/changelog"}
				/>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline" disabled={isStarting}>
							Cancel
						</Button>
					</DialogClose>
					<Button onClick={design} disabled={isStarting || prompt.trim().length < 10} className="min-w-24">
						{isStarting ? <Loader2 className="animate-spin" /> : <Sparkles data-icon="inline-start" />}
						{!isStarting && "Design"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
