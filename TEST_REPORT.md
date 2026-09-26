# Svit&Co test report — 2026-09-26

## Completed in this build

- `node --check server.cjs` — passed.
- `node --check public/js/app.js` — passed.
- `node --check public/js/admin.js` — passed.
- Static requirements test — passed: priority services, separate shower/toilet records, one-time team migration marker, backup function, persistent notification queue, public notification privacy, full requested admin menu, single Add Project button, unchanged `/var/data` disk mount, unsaved-change warning.
- `render.yaml` remains unchanged from the supplied project.

## Functional integration test included

`tests/functional-v4.mjs` performs real HTTP actions when dependencies are installed:

- starts from old-format data;
- verifies the first team migration and no duplicate after restart;
- verifies an existing project's category is preserved;
- creates/edits/hides a second team member;
- creates/edits/hides a page section;
- submits leads using Phone, WhatsApp, Viber, Telegram and Email;
- verifies form idempotency and no duplicate lead;
- verifies protected admin API;
- verifies private notification configuration does not appear in `/api/site`;
- verifies a hidden team member is absent from public data;
- verifies restart persistence.

## Environment limitation during this review

The supplied ZIP did not contain `node_modules`. `npm ci` could not complete in this execution container because package-registry access timed out. Therefore the Express-based integration suite could not be executed here. It is included and should run with `npm test` on Render/GitHub CI or any environment where `npm ci` succeeds.

## External-provider status

Telegram, Resend email, Twilio SMS and Meta WhatsApp Cloud API are implemented but **not claimed as provider-delivery verified** because no real credentials were supplied. The admin panel marks channels not configured until the required environment variables/recipient values exist and provides a test button after setup.

## Luxury editorial v4 — 2026-09-26
- Hero upgraded to full-viewport editorial composition with refined typography and restrained reveal animation.
- Portfolio upgraded to asymmetric 12-column desktop layout with a single-column mobile layout.
- Project detail view upgraded to premium case-study composition and asymmetric gallery.
- Mobile navigation upgraded to a full-screen numbered menu with brand lockup.
- Typography hierarchy refined across hero, sections and project detail views.
- Fullscreen project lightbox upgraded with image counter, caption, keyboard arrows/Escape and touch swipe.
- `npm run check` passed after the changes.
