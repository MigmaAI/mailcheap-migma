import mongoose from "mongoose";

// One per Migma account that connected. accountId is the account's personal Migma workspace, so
// connecting again with a new key lands on the same newsletters.
const accountSchema = new mongoose.Schema(
	{
		accountId: { type: String, required: true, unique: true },
		name: { type: String, trim: true },
		// Sealed with lib/secret-box.js. Public signup forms use it, so it stays until the account disconnects.
		apiKey: { type: String, required: true },
		keyHint: { type: String },
		// The last address test emails went to.
		testEmail: { type: String, lowercase: true, trim: true },
		connectedAt: { type: Date, default: Date.now },
	},
	{ timestamps: true }
);

export default mongoose.models.Account || mongoose.model("Account", accountSchema);
