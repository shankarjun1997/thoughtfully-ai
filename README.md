# Thoughtfully AI

A mobile-friendly Next.js starter for thoughtful Indian occasion planning, shopping-list review, budgets, DIY ideas, and a calendar that can switch between Gregorian and Panchang modes.

> **Current status:** MVP source scaffold. The UI and local rules preview work without external credentials. The DeepSeek-backed analysis route is implemented but requires a server-side API key. Supabase schema is ready to apply, but authentication, cloud persistence, and Panchang/holiday data are not configured by default. Starter calendar events are clearly example data.

## Features

- Responsive dashboard with shopping checklist, spending summary, and upcoming events.
- Smart-list screen with purpose, budget, region, and pasted item list.
- Server-side DeepSeek chat-completions integration via the OpenAI-compatible SDK, with Zod input/output validation, structured JSON output, bounded input sizes, and no API key in client code.
- Clearly labelled local rules preview if the AI key is not configured; this can detect possible duplicates and calculate totals only when all prices are provided.
- Gregorian month/year calendar, personal event creation/deletion, search, and a Panchang-mode switch that explicitly discloses missing Panchang data.
- Browser-local persistence for starter events and checklist; Supabase SQL migration and optional client helper included for the next persistence/auth milestone.
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

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `LLM_API_KEY` | For AI analysis | Server-only DeepSeek credential. Never prefix with `NEXT_PUBLIC_`. |
| `LLM_BASE_URL` | No | OpenAI-compatible base URL; defaults to `https://api.deepseek.com`. |
| `LLM_MODEL` | No | Model name; defaults to `deepseek-chat`. |
| `NEXT_PUBLIC_SUPABASE_URL` | For Supabase | Project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For Supabase | Public/anon key, protected by RLS policies. |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Reserved for trusted server-side jobs only; never expose to browser. |

Do not commit `.env.local` or real secrets.

## AI route

`POST /api/analyze-list` accepts JSON `{ "items": "...", "purpose": "...", "budget": 1500, "region": "Tamil Nadu", "ownedItems": [] }`. It validates the request, calls the DeepSeek chat completions API from the server, requests JSON output, validates the result against a Zod schema, and returns a structured analysis. Missing API configuration returns HTTP 503. The API route has bounded input size but should additionally receive authenticated-user quotas, rate limiting, and abuse monitoring before public launch.

## Supabase setup

1. Create a Supabase project.
2. Apply `supabase/migrations/202610180001_initial_schema.sql` in the SQL editor or with the Supabase CLI.
3. Add the project URL and anon key to `.env.local` / deployment environment.
4. Implement sign-in and server-side ownership checks before using the schema for real users. RLS policies are included, but this starter does not yet ship a complete authenticated persistence flow.

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
4. Configure Supabase variables only after creating the project and applying the migration.
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
