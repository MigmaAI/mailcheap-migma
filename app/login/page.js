import { redirect } from "next/navigation";
import CreditsMailcheap from "@/components/CreditsMailcheap";
import FormLogin from "@/components/FormLogin";
import IllustrationConnect from "@/components/IllustrationConnect";
import { getAccount } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }) {
	// A session whose account disconnected stays here rather than bouncing back to /.
	if (await getAccount()) redirect("/");
	const { next, error } = await searchParams;

	return (
		<main className="flex min-h-dvh flex-col items-center px-4">
			<section className="flex w-full max-w-xs flex-1 flex-col justify-center gap-8 py-16 animate-enter">
				<IllustrationConnect />
				<div className="flex flex-col gap-1.5 text-center">
					<h1 className="text-xl font-semibold tracking-tight">Connect Migma</h1>
					<p className="text-sm text-balance text-muted-foreground">{APP_NAME} for writing. Migma for sending.</p>
				</div>
				<FormLogin next={typeof next === "string" ? next : "/"} error={typeof error === "string" ? error.slice(0, 200) : null} />
			</section>
			<CreditsMailcheap className="items-center pb-8" />
		</main>
	);
}
