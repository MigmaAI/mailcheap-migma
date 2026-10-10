import mongoose from "mongoose";

const newsletterSchema = new mongoose.Schema(
	{
		// The Migma account that owns it (models/Account.js). Every query is scoped by it.
		accountId: { type: String, required: true, index: true },
		name: { type: String, required: true, trim: true },
		slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
		imageUrl: { type: String, trim: true },
		fromName: { type: String, trim: true },
		fromEmail: { type: String, required: true, lowercase: true, trim: true },
		replyTo: { type: String, lowercase: true, trim: true },
		postalAddress: { type: String, trim: true },
		archiveEnabled: { type: Boolean, default: false },
		description: { type: String, trim: true },
		socialLinks: [{ type: String, trim: true }],
		// The archive's author page; the author's name is fromName.
		author: {
			bio: { type: String, trim: true },
			imageUrl: { type: String, trim: true },
		},
		// Where the newsletter lives in Migma: the brand (project) whose contacts it uses, and the list (tag)
		// its subscribers carry. Migma owns the contacts, unsubscribes and bounces.
		migma: {
			projectId: { type: String, required: true },
			tagId: { type: String, required: true },
		},
	},
	{ timestamps: true }
);

export default mongoose.models.Newsletter || mongoose.model("Newsletter", newsletterSchema);
