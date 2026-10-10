"use server";

import { headers } from "next/headers";
import { subscribe as addToList } from "@/lib/contacts";
import { migmaFor } from "@/lib/migma";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import { getAccount } from "@/lib/data/accounts";
import { getArchiveNewsletter } from "@/lib/data/newsletters";
import { normalizeEmail } from "@/lib/validation";

const PER_IP = { name: "subscribe-ip", limit: 5, window: "10 m" };
// Only logged: refusing signups past a shared limit would let one flooder block every real signup.
const PER_NEWSLETTER = { name: "subscribe-newsletter", limit: 300, window: "10 m" };

// The archive's signup form adds the reader to the newsletter's list in Migma, with its owner's key.
// Someone who unsubscribed or bounced stays that way: Migma only adds the tag.
export async function subscribe(_state, formData) {
	// People never see this field; bots fill in every input they find.
	if (formData.get("website")) return { ok: true };

	const email = normalizeEmail(formData.get("email"));
	if (!email) return { error: "Enter a valid email" };

	if (await isRateLimited({ ...PER_IP, key: getClientIp(await headers()) })) {
		return { error: "Too many signups from your network. Try again in a few minutes." };
	}

	const newsletter = await getArchiveNewsletter(String(formData.get("newsletter") ?? ""));
	const account = newsletter && (await getAccount(newsletter.accountId));
	if (!account) return { error: "This newsletter is not taking signups" };

	if (await isRateLimited({ ...PER_NEWSLETTER, key: newsletter.slug })) {
		console.warn(`[subscribe] Over ${PER_NEWSLETTER.limit} signups to ${newsletter.slug} in 10 minutes`);
	}

	try {
		await addToList(migmaFor(account), newsletter, email);
	} catch (error) {
		console.error(`[subscribe] Signup to ${newsletter.slug} failed:`, error.message);
		return { error: "Signups are paused right now. Try again later." };
	}
	return { ok: true };
}
