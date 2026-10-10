import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_OPTIONS, connectAccount } from "@/lib/auth";
import { OAUTH_COOKIE, exchangeCode, isSameState, readPending } from "@/lib/migma-oauth";

function fail(message) {
	redirect(`/login?error=${encodeURIComponent(message)}`);
}

export async function GET(request) {
	const params = new URL(request.url).searchParams;
	const store = await cookies();
	const pending = await readPending(store.get(OAUTH_COOKIE)?.value);
	store.delete({ name: OAUTH_COOKIE, ...COOKIE_OPTIONS });

	if (params.get("error") === "access_denied") fail("Migma access wasn't approved.");
	if (params.get("error")) fail("Migma couldn't sign you in. Try again.");
	if (!pending || !isSameState(params.get("state"), pending.state)) fail("That sign-in link expired. Try again.");
	const code = params.get("code");
	if (!code) fail("Migma didn't send a sign-in code. Try again.");

	try {
		await connectAccount(await exchangeCode({ code, pending }));
	} catch (error) {
		console.error("[auth] Migma sign-in failed:", error.message);
		fail(error.message || "Migma couldn't sign you in. Try again.");
	}
	redirect(pending.next || "/");
}
