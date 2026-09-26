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
