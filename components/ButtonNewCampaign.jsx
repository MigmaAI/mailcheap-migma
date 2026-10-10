"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, PenLine, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { createCampaign } from "@/app/(app)/campaigns/actions";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import DialogDesignCampaign from "@/components/DialogDesignCampaign";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function ButtonNewCampaign({ newsletters }) {
	const [isPending, startTransition] = useTransition();
	const [isDesignOpen, setIsDesignOpen] = useState(false);

	function create(newsletterId) {
		startTransition(async () => {
			const result = await createCampaign(newsletterId);
			if (result?.error) toast.error(result.error);
		});
	}

	if (newsletters.length === 0) {
		return (
			<Button asChild>
				<Link href="/newsletters/new">
					<Plus data-icon="inline-start" />
					New
				</Link>
			</Button>
		);
	}

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button disabled={isPending}>
						{isPending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Plus data-icon="inline-start" />}
						New
						<ChevronDown data-icon="inline-end" className="opacity-60" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-56">
					<DropdownMenuItem onSelect={() => setIsDesignOpen(true)} className="gap-2.5 py-1.5">
						<Sparkles />
						Design with Migma
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					{newsletters.length === 1 ? (
						<DropdownMenuItem onSelect={() => create(newsletters[0].id)} className="gap-2.5 py-1.5">
							<PenLine />
							Write it yourself
						</DropdownMenuItem>
					) : (
						<>
							<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Write it yourself</DropdownMenuLabel>
							{newsletters.map((newsletter) => (
								<DropdownMenuItem key={newsletter.id} onSelect={() => create(newsletter.id)} className="gap-2.5 py-1.5">
									<AvatarNewsletter newsletter={newsletter} size={20} />
									<span className="truncate">{newsletter.name}</span>
								</DropdownMenuItem>
							))}
						</>
					)}
				</DropdownMenuContent>
			</DropdownMenu>
			<DialogDesignCampaign newsletters={newsletters} isOpen={isDesignOpen} onOpenChange={setIsDesignOpen} />
		</>
	);
}
