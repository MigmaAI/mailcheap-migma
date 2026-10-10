"use client";

import { useActionState, useEffect } from "react";
import { Loader2, Zap } from "lucide-react";
import { toast } from "sonner";
import { createInstantDomain } from "@/app/(app)/domains/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function FormInstantDomain() {
	const [state, action, isPending] = useActionState(createInstantDomain, null);

	useEffect(() => {
		if (state?.ok) toast.success(`${state.domain} is ready to send`);
	}, [state]);

	return (
		<form action={action} className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-border animate-enter">
			<div className="flex items-start gap-3">
				<div className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted">
					<Zap className="size-4 text-muted-foreground" />
				</div>
				<div className="min-w-0">
					<p className="font-medium">Instant domain</p>
					<p className="text-sm text-pretty text-muted-foreground">
						Send from yourname.migma.email right away, no DNS. Up to 50 recipients a day: enough to try it, then add
						your own domain for your whole list.
					</p>
				</div>
			</div>
			<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
				<div className="flex flex-1 items-center gap-2">
					<Input name="prefix" required placeholder="yourname" aria-label="Domain name" className="h-9 font-mono" />
					<span className="shrink-0 font-mono text-sm text-muted-foreground">.migma.email</span>
				</div>
				<Button type="submit" variant="outline" disabled={isPending} className="min-w-24">
					{isPending ? <Loader2 className="animate-spin" /> : "Create"}
				</Button>
			</div>
			{state?.error && <p className="text-sm text-destructive">{state.error}</p>}
		</form>
	);
}
