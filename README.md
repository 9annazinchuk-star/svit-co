# Svit&Co renovation website

Bilingual (UA/EN) Node.js + Express website for Svit&Co with a protected administration panel, persistent JSON storage, portfolio, team, media library, lead management and persistent owner-notification queue.

## What changed in this revision

- The hero now prioritizes **«Ремонт квартир під ключ» / “Complete Apartment Renovation”** and remains editable in UA/EN.
- Services are data-driven. The initial order is: complete apartment renovation, shower-room renovation, toilet renovation, then the remaining services. Shower rooms and toilets are separate services and portfolio categories.
- The old single “About specialist” data is migrated once into the first **Team** member. Re-running or restarting does not duplicate it.
- Admin navigation is split into Overview, Leads, Hero, Services, Projects & Portfolio, Team, Page Sections, Media Library, Contacts, Notifications, Brand/General and SEO.
- Public sections, their titles, visibility and order are stored in the database. Added sections use controlled types only; arbitrary JavaScript/HTML is not accepted.
- Leads use one contact field that changes validation according to Phone / WhatsApp / Viber / Telegram / Email. Email is not required when another channel is selected. Convenient call time is optional and only used for phone calls.
- Lead saving is independent from owner notifications. A lead is saved first, then persistent notification queue jobs are processed. A client can get a success response even when a provider is unavailable.
- Repeated form submissions use an idempotency key so the same browser submission does not create a second lead.
- Telegram, email, SMS and WhatsApp owner notifications have separate configuration/status. Provider secrets never appear in public API responses or the database.
- Uploaded images are stored under `DATA_DIR/uploads`, validated by declared MIME type and file signature; if ImageMagick `convert` is available, images are auto-oriented, resized to max 2200×2200 and converted to WebP. If ImageMagick is absent, the validated original is retained.
- Media deletion checks usage first. In-use media requires a replacement URL before deletion.
- Mobile CSS includes flexible cards, whole-button wrapping, no fixed card heights and `prefers-reduced-motion` support.

## Storage and safe migration

Production storage remains on the existing Render Persistent Disk:

```yaml
DATA_DIR=/var/data
mountPath: /var/data
```

The application stores:

- `/var/data/database.json` — settings, services, team, projects, sections, leads and notification queue;
- `/var/data/uploads/` — uploaded public/site images and lead attachments;
- `/var/data/backups/` — automatic pre-migration database backups.

On startup the app checks `schemaVersion`. Before a schema migration it copies the existing database to `backups/`, then performs an idempotent migration. Existing projects, categories and leads are retained. The old `ownerName/aboutUk/aboutEn/aboutImage` values are imported to team member `migrated-owner` only once.

**Do not replace `/var/data/database.json` with a demo database during deploy.** Deploy the code only; the Persistent Disk remains the source of production data.

## Render / GitHub update without data loss

1. Back up `/var/data/database.json` and, if desired, `/var/data/uploads` from the running service.
2. Push or upload this ZIP contents to the same GitHub repository.
3. Keep the existing `render.yaml`, service name and Persistent Disk mount.
4. In Render, confirm `DATA_DIR=/var/data`, `ADMIN_PASSWORD`, `SESSION_SECRET` and `BASE_URL`.
5. Add only the integration environment variables you intend to use (see below).
6. Deploy. On first start the application creates a timestamped pre-migration backup and upgrades the JSON structure.
7. Log in to `/admin`, check Team, Services, Portfolio, Contacts and Notifications before enabling notification channels.

## Owner notifications

Public company contacts and private notification recipients are separate. A client may request a phone call while the owner receives a Telegram notification.

### Telegram Bot API

Required:

- `TELEGRAM_BOT_TOKEN` in Render Environment;
- Chat ID entered in **Admin → Notifications**.

Setup:

1. Create a bot with BotFather and store the token only in Render Environment.
2. Start a conversation with the bot (or add it to the required group/channel with suitable permissions).
3. Obtain the target `chat_id` through Telegram Bot API/update tooling.
4. Enter the Chat ID in the admin panel, enable Telegram, save, then use **Send test notification**.

The server uses Telegram Bot API `sendMessage`. A successful Bot API response is stored as `sent` with the returned message ID.

### Email via Resend

Required:

- `RESEND_API_KEY`;
- `EMAIL_FROM` using a sender/domain allowed by the Resend account;
- recipient email in **Admin → Notifications**.

The server uses Resend's HTTPS API. An accepted API request is recorded as `accepted`; it is deliberately not renamed to “delivered” because an API acceptance is not a delivery receipt.

### SMS via Twilio

Required:

- `TWILIO_ACCOUNT_SID`;
- `TWILIO_AUTH_TOKEN`;
- either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`;
- recipient number in **Admin → Notifications**.

Twilio is a paid external service. Trial accounts and destination countries can have additional verification/regulatory limitations. The returned provider status/SID is stored; queued/accepted is not represented as confirmed delivery.

### WhatsApp Business Cloud API

Required:

- `WHATSAPP_ACCESS_TOKEN`;
- `WHATSAPP_PHONE_NUMBER_ID`;
- `WHATSAPP_TEMPLATE_NAME`;
- optional `WHATSAPP_TEMPLATE_LANGUAGE` (defaults to `en_US`);
- notification recipient in **Admin → Notifications**.

This is an **official business integration**. It does not automate a personal WhatsApp account. A template must exist/be permitted for the account and use case. API acceptance is recorded as `accepted`, not “delivered”.

### Viber contact handling

The public lead form accepts a Viber phone number. In Admin, the contact can always be copied. The project intentionally does not generate an undocumented personal-number deeplink: Viber's documented deeplinks are for bots/public accounts, not a universal personal-number chat URL.

## Notification queue behavior

1. Lead is validated and atomically added to `database.json`.
2. Notification jobs are added to the same persistent database.
3. The HTTP lead response does not depend on Telegram/Resend/Twilio/WhatsApp availability.
4. Failed jobs retry with a capped backoff up to the configured `maxAttempts`.
5. Failed jobs remain visible and can be reset through **Retry notification** in the lead card.
6. Queue/job retry never creates a new lead.

## Environment variables

Core:

- `PORT`
- `NODE_ENV`
- `DATA_DIR`
- `BASE_URL`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`

Optional notification integrations:

- `TELEGRAM_BOT_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `TWILIO_MESSAGING_SERVICE_SID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE`

Never commit real values. The provided `.env.example` contains names only.

## Local start

```bash
npm ci
cp .env.example .env
npm start
```

Open:

- `http://localhost:3000/uk`
- `http://localhost:3000/en`
- `http://localhost:3000/admin`

## Checks

```bash
npm run check
npm test
```

`npm run check` performs syntax checks and static requirement checks. `npm test`, after dependencies are installed, additionally starts the Express server and exercises migration, team/section CRUD, every lead contact method, idempotency, persistence across restart, admin route protection, public-secret filtering, local links/assets and logo persistence.

External Telegram/email/SMS/WhatsApp delivery cannot be confirmed without the owner's real provider credentials. Use each channel's **Send test notification** after connecting it. The included functional test does not pretend that provider delivery occurred.
