"use client";

import { useTransition } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { checkDomain } from "@/app/(app)/domains/actions";
import { Button } from "@/components/ui/button";

// DNS changes can take minutes to show up; Migma also checks on its own.
export default function ButtonCheckDomain({ domain }) {
	const [isChecking, startChecking] = useTransition();

	function check() {
		startChecking(async () => {
			const result = await checkDomain(domain);
			if (result?.error) return void toast.error(result.error);
			if (result.isVerified) return void toast.success(`${domain} is verified. You can send from it.`);
			toast.message("Not verified yet", {
				description: result.issues[0] ?? "DNS changes can take a few minutes. Migma keeps checking.",
			});
		});
	}

	return (
		<Button size="sm" variant="outline" onClick={check} disabled={isChecking}>
			{isChecking ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <RefreshCw data-icon="inline-start" />}
			Check DNS
		</Button>
	);
}
