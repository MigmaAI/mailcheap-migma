import { redirect } from "next/navigation";
import CreditsMailcheap from "@/components/CreditsMailcheap";
import FormLogin from "@/components/FormLogin";
import LogoMailcheap from "@/components/LogoMailcheap";
import { getAccount } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }) {
	// A session whose account disconnected stays here rather than bouncing back to /.
	if (await getAccount()) redirect("/");
	const { next, error } = await searchParams;

	return (
		<main className="flex min-h-dvh items-center justify-center px-4">
			<div className="w-full max-w-xs">
				<div className="mb-8 flex flex-col items-center gap-3 text-center">
					<LogoMailcheap className="size-10" />
					<h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>
					<p className="text-sm text-balance text-muted-foreground">
						Write, send and publish your newsletter. Migma handles the sending.
					</p>
				</div>
				<FormLogin next={typeof next === "string" ? next : "/"} error={typeof error === "string" ? error.slice(0, 200) : null} />
				<CreditsMailcheap className="mt-10 items-center" />
			</div>
		</main>
	);
}
