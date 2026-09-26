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

## Mobile polish v5 — 2026-09-26
- Removed mobile horizontal layout overflow sources and clipped page-level x overflow without changing desktop layout.
- Reworked mobile project case study: cover first, then title + description in a single full-width column; no narrow split text.
- Replaced neon contact surface with a muted sage surface consistent with the editorial palette.
- Added robust hash-navigation handling for mobile menu, footer and CTA links; links also return from project view to home sections.
- Social footer now always renders Facebook/Instagram icons when their public buttons are enabled; without a URL they appear as disabled placeholders, with a URL they become active links.
- `npm run check` passed after changes.


## Admin mobile v6
- Mobile editor is full-screen and uses an internal scroll area.
- Close button stays reachable at the top.
- Cancel / Save controls stay reachable at the bottom and respect iOS safe area.
- Media fields support both selecting from Media Library and direct photo upload.
- Media picker no longer relies on a nested modal `<dialog>`, avoiding iOS Safari nested-dialog issues.
- `npm run check` includes a focused regression test for these requirements.

## Admin v7 checks

- Removed marketing copy from login screen.
- Added aligned lead/WhatsApp actions and localized notification status labels.
- Reworked media upload/library layout.
- Added full backup restore UI and protected restore endpoint with pre-restore safety backup.
- Verified Facebook/Instagram URL fields exist in Contacts.
- `npm run check` passes, including `tests/admin-v7.mjs`.

## Deep audit v8 — 2026-09-26

### Passed locally
- `node --check server.cjs`
- `node --check public/js/app.js`
- `node --check public/js/admin.js`
- Existing static suites: v4, backup-admin, admin-mobile-v6, admin-v7
- New `tests/deep-audit-v8.mjs`
- Verified every referenced built-in `/assets/photos/...` file exists (12 asset paths).
- Verified public section navigation targets exist.
- Verified Facebook/Instagram admin inputs and public rendering code exist.
- Verified Hero, Services, Team, Project cover/gallery and custom Sections all expose media-management paths.
- Verified section-gallery images participate in usage tracking/replacement.
- Verified mobile editor safe-area/scroll rules remain present.
- Verified corrupted JSON protection prevents silent database reset.

### Important runtime-test limitation
The full Express HTTP integration suite (`npm test`) could not be executed in this review container because npm registry/network access is unavailable and the ZIP intentionally does not contain `node_modules`. `npm run check` passes completely. `npm test` remains included for Render/GitHub/local execution after `npm ci`.

This report therefore does **not** claim external provider delivery or browser/device perfection without a live deployment test. The code-level regressions found during the audit were fixed in v8.
