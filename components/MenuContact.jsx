"use client";

import { useTransition } from "react";
import { MoreHorizontal, UserX } from "lucide-react";
import { toast } from "sonner";
import { unsubscribeContact } from "@/app/(app)/contacts/actions";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MenuContact({ newsletterId, email, status }) {
	const [isPending, startTransition] = useTransition();
	if (status !== "subscribed") return null;

	function unsubscribe() {
		startTransition(async () => {
			const result = await unsubscribeContact(newsletterId, email);
			if (result?.error) toast.error(result.error);
		});
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label="Actions" disabled={isPending}>
					<MoreHorizontal />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem variant="destructive" onSelect={unsubscribe}>
					<UserX />
					Unsubscribe
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
