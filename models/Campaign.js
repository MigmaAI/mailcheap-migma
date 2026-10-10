import mongoose from "mongoose";

// review: Migma holds sends from new accounts and large first sends for a quick check before they go out.
export const CAMPAIGN_STATUSES = ["draft", "scheduled", "review", "sending", "sent", "failed", "canceled"];

const counter = { type: Number, default: 0 };

const campaignSchema = new mongoose.Schema(
	{
		accountId: { type: String, required: true, index: true },
		newsletterId: { type: mongoose.Schema.Types.ObjectId, ref: "Newsletter", required: true },
		subject: { type: String, trim: true, default: "" },
		previewText: { type: String, trim: true, default: "" },
		// rich: written in the editor, stored as an HTML fragment in html. html: a designed document sent
		// as is. markdown: older drafts and API campaigns.
		format: { type: String, enum: ["markdown", "html", "rich"], default: "rich" },
		markdown: { type: String, default: "" },
		html: { type: String, default: "" },
		status: { type: String, enum: CAMPAIGN_STATUSES, default: "draft" },
		source: { type: String, default: "dashboard" },
		scheduledAt: { type: Date },
		startedAt: { type: Date },
		sentAt: { type: Date },
		testSentAt: { type: Date },
		archiveSlug: { type: String, trim: true, lowercase: true },
		thumbnailUrl: { type: String, trim: true },
		// Unlisted issues keep their /p/slug page but stay off the archive index.
		archiveListed: { type: Boolean, default: true },
		// Pinned issues sit in the Featured row at the top of the archive.
		archivePinned: { type: Boolean, default: false },
		// Archive page views, once per browser and day.
		webViews: { type: Number, default: 0 },
		// The issue as Migma sends it. Migma turns the HTML into its own email (lib/migma-send.js); contentHash
		// is the content that email was made from, so an unchanged draft isn't prepared twice.
		migma: {
			contentHash: { type: String },
			conversationId: { type: String },
			emailId: { type: String },
			html: { type: String },
			campaignId: { type: String },
			// The email that campaign sends: a campaign made for an older version isn't reused.
			campaignEmailId: { type: String },
			// The Migma generation filling this draft in ("Design with Migma"), until it finishes.
			designing: { type: String },
			error: { type: String },
		},
		// The latest numbers from Migma's campaign stats, for lists and the overview.
		stats: {
			recipients: counter,
			delivered: counter,
			opened: counter,
			clicked: counter,
			bounced: counter,
			unsubscribed: counter,
			updatedAt: { type: Date },
		},
	},
	{ timestamps: true }
);

campaignSchema.index({ accountId: 1, newsletterId: 1, createdAt: -1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ startedAt: -1 });
campaignSchema.index(
	{ archiveSlug: 1 },
	{ unique: true, partialFilterExpression: { archiveSlug: { $type: "string" } } }
);

export default mongoose.models.Campaign || mongoose.model("Campaign", campaignSchema);
