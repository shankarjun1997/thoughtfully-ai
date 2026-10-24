# Thoughtfully AI

A mobile-friendly Next.js starter for thoughtful Indian occasion planning, shopping-list review, budgets, DIY ideas, and a calendar that can switch between Gregorian and Panchang modes.

> **Current status:** MVP source scaffold. The UI and local rules preview work without external credentials. The DeepSeek-backed analysis route is implemented but requires a server-side API key. Supabase schema is ready to apply, but authentication, cloud persistence, and Panchang/holiday data are not configured by default. Starter calendar events are clearly example data.

## Features

- Responsive dashboard with shopping checklist, spending summary, and upcoming events.
- Smart-list screen with purpose, budget, region, and pasted item list.
- Server-side DeepSeek chat-completions integration via the OpenAI-compatible SDK, with Zod input/output validation, structured JSON output, bounded input sizes, and no API key in client code.
- Instagram post/reel import: capture slides or a screenshot, OCR the text, and turn it into a checklist and action plan.
- Clearly labelled local rules preview if the AI key is not configured; this can detect possible duplicates and calculate totals only when all prices are provided.
- Gregorian month/year calendar, personal event creation/deletion, search, and a Panchang-mode switch that explicitly discloses missing Panchang data.
- Browser-local persistence for starter events and checklist; Supabase SQL migration and optional client helper included for the next persistence/auth milestone.
- Consent-based session verification: a mandatory, explicit camera prompt with a face oval, blink liveness and auto-capture shares one still with the workspace administrator; new devices send an automatic security email.
- 7-day free trial, then a one-time ₹200/year Razorpay checkout (disabled safely when keys are absent).
- Public landing page with a capability tour and sample demo, plus `/privacy` and `/terms`.
- Unit tests for list parsing and local analysis.

## Requirements

- Node.js 20.9+ (Node 22 LTS recommended)
- npm
- Optional: DeepSeek (or OpenAI-compatible) API key for AI analysis
- Optional: Supabase project for authenticated cloud storage

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. Without `LLM_API_KEY`, the list-review screen will fall back to a visibly labelled local rules preview.

## Brand assets and app icons

The mark is a six-petal marigold with a warm gold centre and a small spark, drawn on a sage tile.

- `resources/` holds the vector sources and generated Capacitor assets: `icon.png`, `icon-only.png`, `icon-foreground.png` (safe-zone transparent mark), `icon-background.png`, `splash.png`, `splash-dark.png`.
- `npm run icons` regenerates everything with `sharp`: web favicon (`app/favicon.ico`), `app/icon.svg`, `app/apple-icon.png`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png`, `public/favicon-32.png`, plus the Capacitor resources and `public/logo-mark.svg`.
- The web manifest uses the rounded icon for `any` and the full-bleed icon for `maskable`.
- For a Capacitor wrapper, install the Capacitor asset generator and run it from the repo root:

```bash
npm i -D @capacitor/assets
npx capacitor-assets generate --android --ios \
  --iconBackgroundColor '#4c6044' --splashBackgroundColor '#4c6044'
```

Android uses `icon-foreground.png` + `icon-background.png` for the adaptive icon; iOS uses `icon.png`. The splash art is centred so it still works when Android 12+ crops it.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLM_API_KEY` | For AI analysis | Server-only DeepSeek credential. Never prefix with `NEXT_PUBLIC_`. |
| `LLM_BASE_URL` | No | OpenAI-compatible base URL; defaults to `https://api.deepseek.com`. |
| `LLM_MODEL` | No | Model name; defaults to `deepseek-chat`. |
| `BROWSERLESS_TOKEN` | For link import fallback | Screenshot API token used when Instagram slides cannot be fetched directly. |
| `BROWSERLESS_URL` | No | Browserless base URL; defaults to `https://production-sfo.browserless.io`. |
| `VISION_API_KEY` | No | OpenAI-compatible vision key for higher-accuracy OCR. Falls back to Tesseract. |
| `VISION_BASE_URL` | No | Vision API base URL; defaults to `https://api.openai.com/v1`. |
| `VISION_MODEL` | No | Vision model; defaults to `gpt-4o-mini`. |
| `NEXT_PUBLIC_SUPABASE_URL` | For auth + workspaces | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For auth + workspaces | Public/anon key, protected by RLS policies. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Reserved for trusted server-side jobs only; never expose to browser. `SUPABASE_SECRET_KEY` is also accepted. |
| `RAZORPAY_KEY_ID` | For billing | Live/test Razorpay key id. When unset, billing is disabled and no one is blocked. |
| `RAZORPAY_KEY_SECRET` | For billing | Razorpay key secret; server-only. |
| `RAZORPAY_WEBHOOK_SECRET` | For billing | HMAC secret configured on the Razorpay webhook (`/api/billing/webhook`). |
| `RESEND_API_KEY` | For security emails | Sends new-device alerts and consented verification photos. |
| `SECURITY_ALERT_EMAIL` | For security emails | Administrator inbox that receives alerts and photos. |
| `SECURITY_ADMIN_EMAILS` | No | Comma-separated allowlist for `/admin/security`; falls back to `SECURITY_ALERT_EMAIL`. |
| `SECURITY_ALERT_FROM` | For security emails | Verified Resend sender, e.g. `Thoughtfully Security <security@yourdomain.com>`. |
| `SESSION_VERIFICATION_ENABLED` | No | Set to `false` to hide the camera prompt (device alerts still send). Defaults to enabled. |
| `SESSION_VERIFICATION_REQUIRED` | No | Set to `true` to make verification mandatory: middleware blocks all app routes until a signed gate cookie exists. |
| `SECURITY_SESSION_SECRET` | For required mode | HMAC secret (32+ random chars) for the signed httpOnly gate cookie. Falls back to `SUPABASE_SECRET_KEY`. |
| `SECURITY_NOTIFY_USER` | No | Send the user a one-time HTML confirmation after successful verification. Defaults to `true`; set to `false` to disable. |
| `SESSION_VERIFICATION_RETENTION_DAYS` | No | Photo retention before the daily cleanup cron deletes them. Defaults to 30. |

Do not commit `.env.local` or real secrets.

## AI route

`POST /api/analyze-list` accepts JSON `{ "items": "...", "purpose": "...", "budget": 1500, "region": "Tamil Nadu", "ownedItems": [] }`. It validates the request, calls the DeepSeek chat completions API from the server, requests JSON output, validates the result against a Zod schema, and returns a structured analysis. Missing API configuration returns HTTP 503. The API route has bounded input size but should additionally receive authenticated-user quotas, rate limiting, and abuse monitoring before public launch.

## Calendar, holidays and reminders

- The calendar includes a curated India holiday/festival list for 2026–2027 (`lib/holidays.ts`). Dates are planning guides, not Panchang authority.
- Each event has a **Prepare checklist** action that generates an AI checklist and opens it in Smart list.
- **Enable reminders** requests browser notification permission, stores the push subscription in Supabase, and creates one-day-before reminders at 9:00 AM IST.
- A daily Vercel cron (`vercel.json` → `/api/cron/reminders`) sends due reminders through Web Push. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` and `SUPABASE_SECRET_KEY`.
- iOS requires adding the app to the Home Screen before web push works.

## Authentication and multi-tenancy

The app ships with Supabase email/password authentication, protected routes, and workspace-based tenancy.

- `/` is a public marketing/demo page; the planner lives at `/app`.
- `/login` has sign-in, "Create workspace", and a forgot-password flow. `/reset` sets a new password from the recovery link.
- New accounts automatically receive an owner workspace and a 7-day trial through database triggers.
- `/api/session` returns the signed-in user, their workspaces, and the active workspace.
- Users can switch or create workspaces from the sidebar; the active workspace is stored in an httpOnly cookie.
- Lists and events in the browser are namespaced per workspace (`thoughtfully-items-v2:ws:<id>`), so switching never mixes tenants.
- `/account` lets the user export their account data or delete the account and verification photos.
- `/privacy` and `/terms` are public and describe camera verification, retention, billing and deletion.
- When Supabase env vars are absent, the app stays usable in a clearly labelled local mode and `/login` shows setup instructions. Once configured, middleware redirects signed-out visitors to `/login`.

## Consent-based session verification

This is a **consent-based** safety check, mandatory in production. The browser never requests camera access on its own: the prompt appears after sign-in, explains what is shared, and requires a checkbox plus an explicit **Turn on camera** press. Audio is never requested.

- The camera view has a face oval, on-device MediaPipe face detection and a blink challenge. A face must be centred for ~0.8s and a blink detected before a countdown auto-captures one still. No uploads and no manual capture button in normal mode; if the on-device model cannot load, a clearly labelled manual fallback is available and recorded as `manual_fallback`.
- Face detection only checks presence/liveness in the browser. No face recognition, identity matching or biometric template is produced or stored.
- `POST /api/security/session` records the device and emails `SECURITY_ALERT_EMAIL` when a browser signs in for the first time. No photo is involved.
- `POST /api/security/verification` accepts one JPEG/PNG/WebP still, verifies the consent version, stores the photo in the private `session-verifications` bucket, records `liveness_method`, emails the admin a 7-day signed link plus attachment, and sends the **user** one branded HTML confirmation (`SECURITY_NOTIFY_USER`, default on).
- `GET /api/security/verification` lists the caller's own consent history; `DELETE` removes their photos and records.
- `/security` shows the user their verification history, retention window, and a delete-all control.
- Required mode is enforced **server-side**: a successful verification sets a signed, httpOnly `thoughtfully_security_verified` cookie bound to the user id; `middleware.ts` redirects pages to `/verify`, and `lib/security/api-gate.ts` blocks AI/workspace/reminder APIs until verified. Deleting verification history clears the cookie.
- `/admin/security` (allowlisted by `SECURITY_ADMIN_EMAILS` or `SECURITY_ALERT_EMAIL`) lists recent devices and verifications, signs photo URLs for one hour, and can permanently delete a verification.
- `POST /api/cron/security` (daily Vercel cron) deletes photos older than `SESSION_VERIFICATION_RETENTION_DAYS` and device rows idle for 180 days.
- Apply `supabase/migrations/202610220001_session_security.sql` and `202610220004_verification_liveness.sql`, then set the `RESEND_*` / `SECURITY_*` variables.

Before using this with real users, confirm your privacy policy discloses the capture, purpose, recipients and retention period, and that local law permits it. Covert capture is not supported by the app.

## Billing, trial and subscription

- Every new account gets a **7-day free trial** from `auth.users.created_at`.
- After the trial, `/app` redirects to `/subscribe`. The plan is a **one-time ₹200 payment for 365 days** through Razorpay Checkout (Orders API), with no auto-renewal.
- Addresses in `SECURITY_ADMIN_EMAILS` (or `SECURITY_ALERT_EMAIL`) bypass the subscription gate so the owner can always operate the deployment.
- `POST /api/billing/order` creates the order; `POST /api/billing/verify` validates the payment signature, confirms the order belongs to the signed-in user, and activates the year; `POST /api/billing/webhook` is the signed backup path.
- Billing is **disabled when Razorpay keys are absent**: users are not blocked, `/subscribe` explains that payments are not configured, and no charges can be created.
- Apply `supabase/migrations/202610220002_subscriptions.sql` before enabling keys. Subscription writes use the service-role key, so `SUPABASE_SECRET_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) is required.
- Register the live webhook at `https://<your-domain>/api/billing/webhook` with `payment.captured` and `order.paid`, using `RAZORPAY_WEBHOOK_SECRET`.

## Instagram link import

## Instagram link import

Paste a public Instagram post or reel link in Smart list and the app will:

1. Read the embed caption and carousel slide images.
2. Fall back to a Browserless screenshot when slide images cannot be fetched.
3. OCR the slides (local Tesseract, or a vision model when configured).
4. Ask DeepSeek to produce an editable checklist plus an action plan.
5. Let the user add the actions to their calendar.

Set `BROWSERLESS_TOKEN` for screenshot capture. Optional vision OCR is enabled with `VISION_API_KEY` (and `VISION_BASE_URL` / `VISION_MODEL`); otherwise Tesseract runs in the serverless function. Only public posts work, Instagram may rate-limit repeated fetches, and reel audio is not transcribed yet — the caption and on-screen text are used.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/202610180001_initial_schema.sql`, then `supabase/migrations/202610190001_multi_tenant.sql`, in the SQL editor or with the Supabase CLI.
3. Add the project URL and anon key to `.env.local` / deployment environment.
4. In Supabase Auth → URL Configuration, set the Site URL to your deployed origin and add `<origin>/auth/callback` as a redirect URL.
5. Sign up through `/login`; the trigger creates the first workspace automatically.

## Calendar and Panchang accuracy

Gregorian dates use JavaScript date handling in the browser. Panchang mode is currently a UI switch only. Tithi, nakshatra, yoga, karana, muhurtham, and festival observance dates require a verified calculation library or data provider and location/timezone configuration. Do not present AI-generated dates as authoritative. For launch, choose a licensed source, document attribution and update cadence, and verify important dates against a trusted regional calendar.

The included event dates are sample seed data for UI preview, not a verified festival calendar.

## Tests and quality checks

```bash
npm test
npm run lint
npm run build
```

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Set server-side `LLM_API_KEY` and optional `LLM_BASE_URL` / `LLM_MODEL` in Project Settings → Environment Variables.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then apply both migrations to enable the multi-tenant login.
5. Deploy a preview first; test mobile layout, API error paths, privacy, and database RLS before promoting to production.

## Suggested milestones

1. Connect repository and CI checks.
2. Add authentication and persist lists/events in Supabase.
3. Add rate limiting, quotas, and request audit metadata without storing raw sensitive lists unnecessarily.
4. Integrate a licensed Indian holiday/Panchang provider with region and location settings.
5. Add reminder delivery and notification preferences.
6. Add E2E tests, accessibility audit, dependency scanning, and production monitoring.

## Publish to your GitHub account

The current connected GitHub tool session did not expose a repository-creation action or any accessible repositories. After enabling repository creation in your GitHub connection, or after creating an empty private repository named `thoughtfully-ai` on GitHub, run:

```bash
git init -b main
git add .
git commit -m "Build Thoughtfully AI MVP"
git remote add origin https://github.com/<your-github-username>/thoughtfully-ai.git
git push -u origin main
```

If you use GitHub CLI and have authenticated with an account that can create repositories, you can instead run `gh repo create thoughtfully-ai --private --source=. --remote=origin --push` from this directory. Confirm the owner and visibility before running the command.
