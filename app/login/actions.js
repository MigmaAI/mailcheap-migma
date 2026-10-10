"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connectAccount } from "@/lib/auth";
import { getConfigProblems } from "@/lib/config";
import { MigmaRequestError } from "@/lib/migma";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { safeNextPath } from "@/lib/validation";

const ATTEMPTS_PER_IP = { name: "login-ip", limit: 10, window: "15 m" };

// The fallback to "Continue with Migma": a key made in Migma's settings, for self-hosted installs.
export async function connectWithKey(_state, formData) {
	const problems = getConfigProblems();
	if (problems.length > 0) return { error: `Sign-in is off until the server's settings are fixed. ${problems.join(" ")}` };

	if (await isRateLimited({ ...ATTEMPTS_PER_IP, key: getClientIp(await headers()) })) {
		return { error: "Too many attempts. Try again in 15 minutes." };
	}

	const apiKey = String(formData.get("apiKey") ?? "").trim();
	if (apiKey.length < 16 || apiKey.length > 200 || /\s/.test(apiKey)) return { error: "Paste a Migma API key" };

	try {
		await connectAccount(apiKey);
	} catch (error) {
		if (error instanceof MigmaRequestError) return { error: error.message };
		console.error("[login] Connecting Migma failed:", error);
		return { error: "Couldn't reach Migma. Try again in a moment." };
	}
	redirect(safeNextPath(formData.get("next")));
}
