"use server";

import { redirect } from "next/navigation";
import { disconnectAccount, endSession, requireAccount } from "@/lib/auth";

export async function logout() {
	await endSession();
	redirect("/login");
}

export async function disconnect() {
	const account = await requireAccount();
	await disconnectAccount(account.accountId);
	redirect("/login");
}
