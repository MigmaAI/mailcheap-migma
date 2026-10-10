"use server";

import { revalidatePath } from "next/cache";
import { requireMigma } from "@/lib/auth";
import { call } from "@/lib/migma";

const PREFIX_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/;

// An instant <prefix>.migma.email domain: verified at once, no DNS. Migma caps it at 50 recipients a
// day, enough to try things before adding your own domain.
export async function createInstantDomain(_state, formData) {
	const { migma } = await requireMigma();
	const prefix = String(formData.get("prefix") ?? "").trim().toLowerCase();
	if (!PREFIX_PATTERN.test(prefix)) return { error: "Use 3 to 63 lowercase letters, digits and hyphens" };

	try {
		const domain = await call(migma.domains.createManaged({ prefix }));
		revalidatePath("/domains");
		revalidatePath("/");
		return { ok: true, domain: domain?.domain ?? `${prefix}.migma.email` };
	} catch (error) {
		return { error: error.message || "Migma didn't create the domain" };
	}
}
