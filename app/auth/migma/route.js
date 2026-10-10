import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_OPTIONS } from "@/lib/auth";
import { OAUTH_COOKIE, startAuthorization } from "@/lib/migma-oauth";
import { safeNextPath } from "@/lib/validation";

// "Continue with Migma": off to Migma's consent page, where people sign in or create their account.
export async function GET(request) {
	const next = safeNextPath(new URL(request.url).searchParams.get("next"));
	let url;
	try {
		const authorization = await startAuthorization(next);
		const store = await cookies();
		store.set(OAUTH_COOKIE, authorization.pending, { ...COOKIE_OPTIONS, maxAge: authorization.maxAge });
		url = authorization.url;
	} catch (error) {
		console.error("[auth] Couldn't start Migma sign-in:", error.message);
		redirect(`/login?error=${encodeURIComponent("Couldn't reach Migma. Try again in a moment.")}`);
	}
	redirect(url);
}
