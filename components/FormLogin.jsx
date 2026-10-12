"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { connectWithKey } from "@/app/login/actions";
import InfoTip from "@/components/InfoTip";
import LogoMigma from "@/components/LogoMigma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIGMA_API_KEYS_URL } from "@/lib/config";

export default function FormLogin({ next, error }) {
	const [state, action, isPending] = useActionState(connectWithKey, null);
	const message = state?.error ?? error;

	return (
		<div className="flex flex-col gap-4">
			<Button asChild size="lg">
				<a href={`/auth/migma?next=${encodeURIComponent(next || "/")}`}>
					<LogoMigma variant="mark" height={18} surface="inverse" />
					Continue with Migma
				</a>
			</Button>
			{message && (
				<p role="alert" className="text-center text-sm text-destructive">
					{message}
				</p>
			)}

			<details className="group">
				<summary className="flex cursor-pointer list-none items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
					Use an API key
					{/* What the Migma sign-in grants (lib/migma-oauth.js SCOPES), in plain words. */}
					<InfoTip label="What Mailcheap can access" side="bottom">
						New to Migma? You sign up on the next step. Mailcheap can add contacts and lists, create, design and
						send emails, and set up sending domains and brands. Disconnect any time from your Migma API keys.
					</InfoTip>
				</summary>
				<form action={action} className="mt-3 flex gap-2">
					<input type="hidden" name="next" value={next || "/"} />
					<Input
						name="apiKey"
						type="password"
						placeholder="Migma API key"
						autoComplete="off"
						spellCheck={false}
						required
						aria-label="Migma API key"
						className="h-9 font-mono"
					/>
					<Button type="submit" variant="outline" disabled={isPending} className="min-w-20">
						{isPending ? <Loader2 className="animate-spin" /> : "Connect"}
					</Button>
				</form>
				<a
					href={MIGMA_API_KEYS_URL}
					target="_blank"
					rel="noreferrer"
					className="mt-2 block text-center text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
				>
					Get a key in Migma
				</a>
			</details>
		</div>
	);
}
