-- Mailcheap on Migma keeps only its own state here: who connected, newsletter settings, drafts and the
-- archive. Contacts, sends, unsubscribes, bounces and stats live in Migma.
-- Dates are ISO 8601 UTC strings, so they sort as text.

-- One row per Migma account that connected (its personal Migma workspace).
CREATE TABLE accounts (
	account_id TEXT PRIMARY KEY,
	name TEXT,
	-- The account's Migma key, sealed with AES-256-GCM (lib/secret-box.js).
	api_key TEXT NOT NULL,
	key_hint TEXT,
	test_email TEXT,
	connected_at TEXT NOT NULL,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

-- The client id Migma's OAuth server registered for each callback URL.
CREATE TABLE oauth_clients (
	redirect_uri TEXT PRIMARY KEY,
	client_id TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE TABLE newsletters (
	id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL,
	name TEXT NOT NULL,
	-- Public: /archive/<slug>.
	slug TEXT NOT NULL UNIQUE,
	image_url TEXT,
	from_name TEXT,
	from_email TEXT NOT NULL,
	reply_to TEXT,
	postal_address TEXT,
	archive_enabled INTEGER NOT NULL DEFAULT 0,
	description TEXT,
	social_links TEXT NOT NULL DEFAULT '[]',
	author_bio TEXT,
	author_image_url TEXT,
	-- The Migma brand whose contacts it uses, and the list (tag) its subscribers carry.
	migma_project_id TEXT NOT NULL,
	migma_tag_id TEXT NOT NULL,
	-- The archive's "Join N readers", refreshed from Migma at most hourly.
	readers_count INTEGER,
	readers_counted_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX newsletters_by_account ON newsletters (account_id, created_at);

CREATE TABLE campaigns (
	id TEXT PRIMARY KEY,
	account_id TEXT NOT NULL,
	newsletter_id TEXT NOT NULL REFERENCES newsletters (id),
	subject TEXT NOT NULL DEFAULT '',
	preview_text TEXT NOT NULL DEFAULT '',
	-- rich: an HTML fragment from the editor. html: a designed document. markdown: older drafts.
	format TEXT NOT NULL DEFAULT 'rich' CHECK (format IN ('rich', 'html', 'markdown')),
	markdown TEXT NOT NULL DEFAULT '',
	html TEXT NOT NULL DEFAULT '',
	status TEXT NOT NULL DEFAULT 'draft'
		CHECK (status IN ('draft', 'scheduled', 'review', 'sending', 'sent', 'failed', 'canceled')),
	source TEXT NOT NULL DEFAULT 'dashboard',
	scheduled_at TEXT,
	started_at TEXT,
	sent_at TEXT,
	test_sent_at TEXT,
	-- Public: /p/<archive_slug>, unique across newsletters.
	archive_slug TEXT,
	thumbnail_url TEXT,
	archive_listed INTEGER NOT NULL DEFAULT 1,
	archive_pinned INTEGER NOT NULL DEFAULT 0,
	web_views INTEGER NOT NULL DEFAULT 0,
	-- The issue as Migma sends it (lib/sending.js).
	migma_content_hash TEXT,
	migma_conversation_id TEXT,
	migma_email_id TEXT,
	migma_html TEXT,
	migma_campaign_id TEXT,
	migma_campaign_email_id TEXT,
	migma_designing TEXT,
	migma_error TEXT,
	-- The latest numbers from Migma's campaign stats.
	stats_recipients INTEGER NOT NULL DEFAULT 0,
	stats_delivered INTEGER NOT NULL DEFAULT 0,
	stats_opened INTEGER NOT NULL DEFAULT 0,
	stats_clicked INTEGER NOT NULL DEFAULT 0,
	stats_bounced INTEGER NOT NULL DEFAULT 0,
	stats_unsubscribed INTEGER NOT NULL DEFAULT 0,
	stats_updated_at TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);
CREATE INDEX campaigns_by_account ON campaigns (account_id, newsletter_id, created_at);
CREATE INDEX campaigns_by_status ON campaigns (account_id, status, stats_updated_at);
CREATE INDEX campaigns_archive ON campaigns (newsletter_id, status, sent_at);
CREATE UNIQUE INDEX campaigns_archive_slug ON campaigns (archive_slug) WHERE archive_slug IS NOT NULL;
