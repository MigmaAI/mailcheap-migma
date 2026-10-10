# Security

## What's built in

- **Sign-in is Migma's.** "Continue with Migma" is OAuth with PKCE (S256) and a `state` checked in constant time; the verifier and state ride in a 10-minute signed, httpOnly cookie. After sign-in, the app only lands on paths of its own.
- **Migma keys are encrypted at rest** (AES-256-GCM, key derived from `SESSION_SECRET`). Public signup forms use the newsletter owner's key, so it stays until the account disconnects; disconnecting deletes it and ends every session for the account. The key itself stays valid in Migma until it's revoked in Migma's settings.
- **Every account only sees its own data.** Sessions name a Migma account (its personal workspace). Every dashboard page and server action loads that account and scopes every newsletter and campaign query by it. Contacts, domains and campaigns are read and written in Migma with the account's own key, so Migma enforces the same boundary.
- The app refuses to start with a `SESSION_SECRET` under 32 characters. Sessions last 30 days, in an httpOnly cookie (`__Host-` prefixed in production) signed with a key derived from `SESSION_SECRET`.
- Nothing is sent or tested unless `SENDING_ENABLED` is `true`. Each send is claimed once in the database before Migma is called, and every Migma write carries an idempotency key, so a double click or a retry can't send twice.
- Public endpoints (signup form, views, API-key sign-in) are rate limited. With Upstash Redis the limits are shared across server instances; without it, each instance counts in memory.
- Issue HTML shown inline on the archive goes through an allowlist cleaner, then `sanitize-html`, every time the page renders. HTML issues, including Migma designs, render in a sandboxed iframe without scripts.
- Every response carries a Content Security Policy (no framing, no plugins, no inline event handlers, forms and `<base>` limited to the app's origin) and HSTS.
- Unsubscribe links, one-click List-Unsubscribe headers, suppression of bounces and complaints, and open and click tracking are Migma's.

## The archive's domain

Issue pages show HTML from the editor and from Migma. Give each newsletter its own archive domain (`ARCHIVE_HOSTS`): that HTML then never shares the dashboard's origin, and the app domain's `/archive` pages redirect there. Without one, the archive stays on the app domain, protected by the sanitizer, the sandboxed frame and the Content Security Policy. A hosted install should serve archives from a domain that doesn't share cookies with the dashboard.

## Reporting a vulnerability

Email support@migma.ai with "Security" in the subject.
