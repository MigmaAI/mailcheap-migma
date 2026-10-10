"use client";

import { useActionState, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addDomain } from "@/app/(app)/domains/actions";
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

export default function DialogAddDomain() {
	const [isOpen, setIsOpen] = useState(false);
	const [state, action, isPending] = useActionState(async (previous, formData) => {
		const result = await addDomain(previous, formData);
		if (result?.ok) {
			toast.success(`${result.domain} added. Add its DNS records to start sending.`);
			setIsOpen(false);
		}
		return result;
	}, null);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !isPending && setIsOpen(open)}>
			<DialogTrigger asChild>
				<Button>
					<Plus data-icon="inline-start" />
					Add domain
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<form action={action} className="flex flex-col gap-4">
					<DialogHeader>
						<DialogTitle>Add your domain</DialogTitle>
						<DialogDescription>
							Send from your own name, to your whole list. A subdomain like mail.example.com keeps your main domain&apos;s
							email safe.
						</DialogDescription>
					</DialogHeader>
					<Input
						name="domain"
						required
						autoFocus
						autoComplete="off"
						spellCheck={false}
						placeholder="mail.example.com"
						aria-label="Domain"
						className="h-10 font-mono"
					/>
					{state?.error && (
						<p role="alert" className="text-sm text-destructive">
							{state.error}
						</p>
					)}
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline" disabled={isPending}>
								Cancel
							</Button>
						</DialogClose>
						<Button type="submit" disabled={isPending} className="min-w-20">
							{isPending ? <Loader2 className="animate-spin" /> : "Add"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
