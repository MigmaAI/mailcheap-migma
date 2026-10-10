# Mailcheap on Migma

Newsletters without the infrastructure. Write an issue (or let Migma design it on your brand), send it to your list, publish it on the web. Migma handles the sending: domains, deliverability, bounces, complaints, unsubscribes, open and click tracking.

A fork of [Mailcheap](https://github.com/marclou/mailcheap) by [Marc Lou](https://x.com/marclou), MIT licensed. Mailcheap runs on your own Amazon SES, MongoDB, QStash and Redis. This version swaps all of that for one connection: **Continue with Migma**.

| | Mailcheap | Mailcheap on Migma |
| --- | --- | --- |
| Sending | Your Amazon SES (production access request, IAM, configuration set) | Migma |
| Bounces and complaints | SNS topic + webhook | Migma suppresses them for you |
| Background sends and scheduling | Upstash QStash | Migma campaigns |
| Domains | DKIM, MAIL FROM and DMARC by hand in SES | Migma domains, with an instant `yourname.migma.email` to start |
| Unsubscribes | Signed links + RFC 8058 headers | Migma's links + RFC 8058 headers |
| Open and click tracking | Your app's domain | Migma, bot and Apple Mail prefetches filtered |
| Writing | Editor, Markdown, HTML | The same editor, plus **Design with Migma** |
| Setup | About an hour | Sign in |

## Features

**Write and send**

- The Mailcheap editor with a live email preview, slash commands, image uploads and boxes. Raw HTML works too.
- **Design with Migma**: describe the issue in a sentence or two; Migma writes and designs it on your brand. You review it before anything is sent.
- Checks before every send: subject, preview text, unsubscribe link, size under Gmail's 100 KB clip, postal address, verified domain, test sent.
- Test emails show exactly what Migma will send. Send now or schedule.

**Grow the list**

- Several newsletters, each on one of your Migma brands with its own list, from address, reply-to and postal address.
- A signup form on each newsletter's archive page. Subscribers become contacts in Migma.
- CSV import from any platform. People who unsubscribed or bounced stay that way: Migma never subscribes them again.

**Publish and measure**

- A public archive for each newsletter: issue pages, author page, share images, sitemap. Optional custom domain.
- Campaign reports from Migma: delivered, opened, clicked, bounced, unsubscribed.
- An overview of the last 30 days per newsletter, your sending against your Migma plan, and your domains' health.

## Use it

Hosted: open the app and **Continue with Migma**. New to Migma? You create your account on that step. That's the whole setup.

Then:

1. **Domains**: create an instant `yourname.migma.email` domain to try it (Migma caps those at 50 recipients a day), and add your own domain in Migma to send to your whole list.
2. **Newsletters**: create one on a Migma brand, with a from address on a verified domain and your postal address.
3. **Contacts**: import a CSV, or add the signup form by turning on the public archive.
4. **Campaigns**: write an issue or Design with Migma, send yourself a test, then send.

## Self-host

The code is open; run your own copy with your own Migma account.

```bash
git clone https://github.com/<you>/mailcheap-migma.git && cd mailcheap-migma
npm install
cp .env.example .env.local   # set SESSION_SECRET (openssl rand -base64 48)
npm run dev:local            # starts a local MongoDB in .data/ and the app on http://localhost:3100
```

On a server: set `SESSION_SECRET`, `MONGODB_URI` (a free MongoDB Atlas cluster works) and `APP_URL`, then `npm ci && npm run build && npm start` behind HTTPS. "Continue with Migma" registers your copy with Migma's sign-in on first use; its callback is `APP_URL/auth/migma/callback`. You can also sign in with an API key from [Migma settings](https://migma.ai/settings/api-keys).

`npm test` runs the unit tests and `npm run lint` runs ESLint.

## Environment variables

| Variable | Required | What it does |
| --- | --- | --- |
| `SESSION_SECRET` | Yes | Signs sessions and encrypts each account's Migma key. 32+ random characters. Changing it signs everyone out. |
| `MONGODB_URI` | Yes (not with `dev:local`) | Drafts, newsletter settings and the archive. Contacts live in Migma. |
| `APP_URL` | On other hosts | Public URL of the app: archive links and the Migma sign-in callback. On Vercel it defaults to the production domain. |
| `SENDING_ENABLED` | To send | Nothing is sent or tested unless it's `true` |
| `MIGMA_API_URL` | No | Another Migma API base URL. Defaults to `https://api.migma.ai/v1`. |
| `MIGMA_OAUTH_CLIENT_ID` | No | Use a Migma OAuth client you registered instead of registering one on first sign-in |
| `ARCHIVE_HOSTS` | No | Archive domains, like `news.example.com=weekly,letters.example.org=monthly` |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | No | Rate limits shared by every server instance |
| `BLOB_READ_WRITE_TOKEN` | No | Image uploads in the editor (set by Vercel Blob) |

## How it works

- Next.js App Router, JavaScript, Tailwind CSS with shadcn/ui, MongoDB through Mongoose, and the official [`migma`](https://www.npmjs.com/package/migma) SDK. Every Migma call uses the signed-in account's own key, so Migma decides what each account can see and do.
- **Continue with Migma** is OAuth with PKCE against Migma's authorization server. The token Migma returns is a scoped API key; the app stores it encrypted (AES-256-GCM) so public signup forms keep working after you sign out. Disconnecting deletes it.
- A newsletter is a list (a tag) on one of your Migma brands. Contacts, unsubscribes, bounces and complaints are Migma's.
- **Sending**: the issue is rendered with Mailcheap's template, with Migma's `{{unsubscribe_url}}` in the footer, and turned into a Migma email. Migma rewrites it in its own format, so the test email is the final word; an unchanged issue isn't prepared twice. Then a Migma campaign goes to the newsletter's list. Migma skips anyone who unsubscribed, bounced or complained, and may check a new account's first large send before it goes out ("In review").
- Reports come from Migma's campaign stats. Archive pages are static and refresh when you send or save.

## Not in this version

What Mailcheap does on SES that this version doesn't do yet: confirmed opt-in and welcome emails (set up a welcome flow with Migma automations instead), list cleanup, sending in steps to your most engaged readers first, per-mailbox-provider reports, the signup and drafts API (Migma's own API covers contacts and campaigns), and the subscriber growth and hourly sends charts.

## License

[MIT](LICENSE). Mailcheap by [Marc Lou](https://x.com/marclou); Migma version by [Migma](https://migma.ai).
