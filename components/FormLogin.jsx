"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { connectWithKey } from "@/app/login/actions";
import LogoMigma from "@/components/LogoMigma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIGMA_API_KEYS_URL } from "@/lib/config";

export default function FormLogin({ next, error }) {
	const [state, action, isPending] = useActionState(connectWithKey, null);
	const message = state?.error ?? error;

	return (
		<div className="flex flex-col gap-4">
			{/* The page's one Migma Pink element (brand book): Ink on Pink, the official mark. */}
			<a
				href={`/auth/migma?next=${encodeURIComponent(next || "/")}`}
				className="inline-flex h-11 items-center justify-center gap-2.5 rounded-lg bg-migma-pink px-5 text-sm font-semibold text-migma-ink outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:ring-3 focus-visible:ring-migma-pink/40"
			>
				<LogoMigma variant="mark" height={20} surface="light" />
				Continue with Migma
			</a>
			<p className="text-center text-xs text-muted-foreground">New to Migma? You create your account on the next step.</p>
			{message && (
				<p role="alert" className="text-center text-sm text-destructive">
					{message}
				</p>
			)}

			<details className="group mt-2 border-t border-border/60 pt-4">
				<summary className="cursor-pointer list-none text-center text-xs text-muted-foreground transition-colors select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
					Use an API key instead
				</summary>
				<form action={action} className="mt-3 flex flex-col gap-3">
					<input type="hidden" name="next" value={next || "/"} />
					<Input
						name="apiKey"
						type="password"
						placeholder="Migma API key"
						autoComplete="off"
						spellCheck={false}
						required
						aria-label="Migma API key"
						className="h-10 font-mono"
					/>
					<p className="text-xs text-muted-foreground">
						Create one in{" "}
						<a href={MIGMA_API_KEYS_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
							Migma settings
						</a>{" "}
						with audience, email, campaign and domain access.
					</p>
					<Button type="submit" variant="outline" disabled={isPending}>
						{isPending ? <Loader2 className="animate-spin" /> : "Connect"}
					</Button>
				</form>
			</details>
		</div>
	);
}
