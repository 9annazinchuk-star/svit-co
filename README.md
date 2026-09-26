# Svit&Co renovation website

Bilingual (UA/EN) renovation-company website with a protected admin panel, persistent JSON data, media uploads, portfolio, team management, enquiry tracking, and durable notification queue. The project is designed for GitHub + Render and keeps the existing `render.yaml` Persistent Disk mounted at `/var/data`.

## What changed in v4

- Hero now prioritizes **«Ремонт квартир під ключ» / “Complete Apartment Renovation”** with editable UA/EN copy, image, and supported button actions.
- Services are editable, ordered, publishable, and connected to portfolio categories. Initial order: complete apartment renovation, shower rooms, toilets, then the remaining services.
- Legacy single-craftsperson fields migrate once into the first **Team** record. Migration is idempotent and writes a pre-migration database backup.
- Admin sections are separated: Overview, Leads, Hero, Services, Projects & Portfolio, Team, Page Sections, Media Library, Contacts, Notifications, Brand, SEO.
- Configurable page sections and automatic navigation hide links for unpublished sections.
- Media library checks the actual image signature before accepting JPG/PNG/WebP/AVIF. When ImageMagick `convert` is available, uploads are auto-oriented, stripped of metadata, resized to max 2560×2560 without stretching, and recompressed. If ImageMagick is unavailable, validated originals are preserved rather than breaking an upload.
- Enquiry contact method is dynamic: phone, WhatsApp, Viber use an international number; Telegram accepts `@username` or a `https://t.me/...` profile; email accepts an email address. Convenient contact time is shown only for calls.
- Enquiries are saved **before** notification delivery. A persistent notification queue survives restart/deploy, retries failures with a cap, supports manual retry, and does not create duplicate enquiries.
- Public API never returns notification credentials. All API tokens/secrets stay in environment variables.
- Notification provider states distinguish `accepted` from `delivered`.

## Data and safe update

Persistent files live under `DATA_DIR` (Render: `/var/data`):

- `/var/data/database.json` — settings, services, team, projects, leads, media metadata, notification queue and attempts.
- `/var/data/uploads/` — uploaded images.
- `/var/data/database.pre-v4.<timestamp>.bak.json` — automatic backup made before schema migration.

The migration is repeat-safe. It never replaces an existing working database with demo data. Missing v4 fields are added while existing settings/projects/leads are retained. The old `ownerName/aboutUk/aboutEn/aboutImage` fields are imported to Team only once using `migrations.teamFromLegacy`.

### Updating on Render without data loss

1. Keep the current Render Persistent Disk mounted at `/var/data`.
2. Keep `DATA_DIR=/var/data`.
3. Deploy the new repository/ZIP normally.
4. On first boot, the server backs up the old JSON before migrating it.
5. Do **not** delete the Render disk and do not change `DATA_DIR` to an ephemeral path.

`render.yaml` keeps the existing Persistent Disk configuration.

## Required environment variables

Core:

- `ADMIN_PASSWORD` — admin password.
- `SESSION_SECRET` — long random session signing secret.
- `BASE_URL` — public HTTPS URL, e.g. `https://example.com`.
- `DATA_DIR` — `/var/data` on Render (already set by `render.yaml`).

### Telegram notifications

Official Telegram Bot API is used server-side.

1. Create a bot with `@BotFather` and copy the bot token.
2. Start a chat with the bot (or add it to the intended group/channel with suitable rights).
3. Obtain the target `chat_id`.
4. Set `TELEGRAM_BOT_TOKEN` in Render.
5. In **Admin → Notifications**, enter the `chat_id`, enable Telegram, save, then use **Send test notification**.

The token is never stored in `database.json` and is never returned by public APIs.

### Email notifications (Resend REST API)

Set:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` — a verified sender/domain in Resend.

Then enter the destination email in **Admin → Notifications**, enable Email and send a test. API acceptance is stored as `accepted`; it is not falsely labelled as final inbox delivery.

### SMS notifications (Twilio Programmable Messaging)

Set:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER` — SMS-capable Twilio number in E.164 format.

Enter the recipient in E.164 format (for example `+48...`) in **Admin → Notifications**. Provider acceptance is not treated as confirmed handset delivery unless the provider response itself reports `delivered`.

### WhatsApp notifications (official WhatsApp Business Cloud API only)

Set:

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TEMPLATE_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE` — defaults to `uk`.
- `WHATSAPP_API_VERSION` — optional Graph API version override.

The configured WhatsApp template must be approved for the business account and must contain **one body text variable**, because Svit&Co sends the compact enquiry summary as that parameter. The system does not automate a personal WhatsApp account and does not replace automatic notifications with a `wa.me` link.

The public direct WhatsApp button remains a separate client convenience feature; opening it does not create an enquiry.

### Test adapter

For local automated notification tests only:

- `NOTIFICATION_TEST_MODE=1`

This bypasses real external providers and records a synthetic delivered result. Do not use it in production.

## Public contact links

- Phone: `tel:`.
- Email: `mailto:`.
- WhatsApp: `https://wa.me/<international-number>`.
- Telegram: `https://t.me/<username>` when a username/profile is configured.
- Viber phone contacts are intentionally shown with **copy-contact fallback** instead of pretending an undocumented/unsupported personal-number deep link is guaranteed. Viber’s documented bot deep links use a bot `chatURI`, and bot messaging requires a commercial bot/subscription flow.

## Development

```bash
npm ci
npm run check
npm test
npm start
```

Open:

- Site: `http://localhost:3000/uk`
- English: `http://localhost:3000/en`
- Admin: `http://localhost:3000/admin`

If `ADMIN_PASSWORD` is unset locally, the legacy development fallback is `change-me-now`; never use that in production.

## Security notes

- Admin data routes require an authenticated session.
- Login and enquiry routes are rate-limited.
- Upload size is capped; image content is signature-checked server-side.
- User text is stripped of `<`/`>` before persistence/display.
- Notification credentials stay in environment variables.
- `/api/site` removes the private notification settings object before returning public data.
- Admin links included in notifications still require normal login.

## Test scope

`npm run check` performs JavaScript syntax checks. The project also contains smoke/link tests intended to run with installed npm dependencies. For notification integrations without production credentials, use `NOTIFICATION_TEST_MODE=1` and verify queue persistence/retry without contacting a provider. Real Telegram/email/SMS/WhatsApp delivery is only confirmed after the owner supplies valid credentials and provider/business approvals where required.
