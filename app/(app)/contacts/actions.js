"use server";

import { revalidatePath } from "next/cache";
import { requireMigma } from "@/lib/auth";
import { importRows, unsubscribe } from "@/lib/contacts";
import { MAX_IMPORT_ROWS_PER_REQUEST, sanitizeImportRow } from "@/lib/csv-import";
import { getNewsletter } from "@/lib/data/newsletters";
import { isObjectIdString, normalizeEmail } from "@/lib/validation";

async function findNewsletter(newsletterId) {
	const { accountId, migma } = await requireMigma();
	if (!isObjectIdString(newsletterId)) return { migma, newsletter: null };
	return { migma, newsletter: await getNewsletter(accountId, newsletterId) };
}

// Rows come from the browser, so each is checked again. Migma keeps existing opt-outs.
export async function importContacts({ newsletterId, rows }) {
	if (!Array.isArray(rows) || rows.length > MAX_IMPORT_ROWS_PER_REQUEST) return { error: "Too many rows" };
	const { migma, newsletter } = await findNewsletter(newsletterId);
	if (!newsletter) return { error: "Newsletter not found" };

	const clean = rows.map(sanitizeImportRow).filter(Boolean);
	try {
		const result = await importRows(migma, newsletter, clean);
		revalidatePath("/contacts");
		return { ...result, invalid: result.invalid + rows.length - clean.length };
	} catch (error) {
		console.error("[contacts] Import failed:", error);
		return { error: error.message || "Migma didn't take the import" };
	}
}

export async function unsubscribeContact(newsletterId, email) {
	const { migma, newsletter } = await findNewsletter(newsletterId);
	if (!newsletter) return { error: "Newsletter not found" };
	const address = normalizeEmail(email);
	if (!address) return { error: "Invalid request" };

	try {
		await unsubscribe(migma, newsletter, address);
	} catch (error) {
		return { error: error.message || "Migma didn't take the change" };
	}
	revalidatePath("/contacts");
	return { ok: true };
}
