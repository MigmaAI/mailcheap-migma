import mongoose from "mongoose";

// The client id Migma's OAuth server registered for this app's callback URL (RFC 7591), so the
// consent page names the app. One per callback URL; registered on the first "Continue with Migma".
const oauthClientSchema = new mongoose.Schema(
	{
		redirectUri: { type: String, required: true, unique: true },
		clientId: { type: String, required: true },
	},
	{ timestamps: true }
);

export default mongoose.models.OAuthClient || mongoose.model("OAuthClient", oauthClientSchema);
