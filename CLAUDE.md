# CLAUDE.md

Guidance for an AI assistant (or a new developer) picking up this repository.

## What this is

A reporting platform for **Bayland Finance**, a mortgage and asset finance
broking business in Australia. It replaces a Microsoft BI + Excel Online
workflow with a purpose-built, compliance-aware system: pipeline tracking,
settlements, commissions, lender/product mix, and client/referral reporting,
scoped per-broker under NCCP and Australian Privacy Act obligations.

Staff log in with email/password + mandatory TOTP MFA. Roles are `admin`
(firm-wide visibility), `broker` (own book only), and `assistant`. There is
no self-service sign-up — admins create accounts directly.

## Stack and architecture

Next.js (App Router) on Vercel, Supabase (Postgres + Auth + Row Level
Security) in the Sydney region. Full detail in `docs/ARCHITECTURE.md`; the
one fact worth internalising before touching anything here:

**RLS is the real access-control boundary, not application code.**
`supabase/migrations/0002_rls_policies.sql` is what actually stops one
broker from seeing another's clients. Page components and middleware are UX
conveniences on top of that, never the enforcement itself. If you add a
table holding client data, write its RLS policy before the page that
queries it.

See also: `docs/SECURITY.md`, `docs/COMPLIANCE.md`, `docs/SETUP.md` (the
last one documents the exact spreadsheet column format this system imports
against, and known data-quality issues in the source sheet).

## Repository structure

```
app/
  dashboard/            Authenticated report pages (Overview, Pipeline &
                         Settlements, Commissions, Lenders & Products,
                         Clients & Referrals, My account, admin/*)
  dashboard/admin/       Admin-only: Import Data, Users & Access
  api/graph/             Microsoft Graph OAuth connect/callback + sync route
  login, mfa-enroll,     Auth flows outside the dashboard layout
  auth/set-password

lib/
  reports/queries.ts     All report aggregation logic — one function per
                         report, each RLS-scoped via the anon-key client,
                         each logging one audit_log entry per view
  import/                Spreadsheet parsing (exceljs) and the shared
                         upsert logic used by both manual upload and the
                         Graph sync job (syncRows.ts — see "how loans are
                         matched across uploads" below)
  auth/                  Session loading (session.ts) and role gating
                         (rbac.ts)
  audit/log.ts            Append-only audit log writer (service-role only)
  graph/                  Microsoft Graph client + refresh-token encryption
  supabase/               Three distinct Supabase client factories — see
                         "Supabase clients" below
  types/database.ts       Hand-written type mirroring the Postgres schema

components/
  charts/                 Shared report UI: Card, StatTile, TrendArea,
                         DonutBreakdown, HorizontalBarList
  account/, nav/, pipeline/, import/, ui/   Feature-scoped UI

supabase/migrations/      Numbered, append-only — never edit an applied
                         migration, always add a new one
```

### Supabase clients — use the right one

- `lib/supabase/client.ts` `createClient()` — browser, anon key. Only for
  client components that need their own session (e.g. reading an invite
  link's session on `/auth/set-password`).
- `lib/supabase/server.ts` `createClient()` — server, anon key, cookie-bound
  to the current request. Use this for anything user-facing; RLS applies.
- `lib/supabase/server.ts` `createServiceRoleClient()` — bypasses RLS.
  Server-only, never imported into anything that echoes user input back
  into a query. Used for admin actions and the audit log writer.
- `lib/supabase/server.ts` `createStatelessAnonClient()` — anon key, no
  cookie storage at all. Use this to verify a credential (e.g.
  `signInWithPassword` to check a current password) without mutating the
  caller's real session — calling the regular client for that silently
  overwrites the user's actual session with a fresh, lower-assurance one.

### How loans are matched across spreadsheet uploads

There's no stable ID column in the source sheet, so `lib/import/syncRows.ts`
identifies a loan by `client name + broker + earliest recorded date`
(enquiry, falling back to application, then quote). Lender is deliberately
**not** part of this key — it changes legitimately as a deal gets shopped
around, and including it caused real duplicate rows in production (see git
history around the "Drop lender from the loan-matching key" commit). A
repeat client with no distinguishing date gets disambiguated by occurrence
order within one upload, which is a real but accepted residual limitation —
see the comments in `syncRows.ts` and `docs/SETUP.md` before changing this
again.

### Conventions established in this codebase

- **Server Actions return `{ ok: true } | { ok: false; error: string }`**,
  not thrown errors, for any outcome a user can trigger validly (bad input,
  a rate limit, a blocked delete). Next.js can mangle a thrown Server
  Action error's message in production; a plain result object sidesteps
  that entirely. `throw` is still fine for genuinely-should-never-happen
  cases.
- **Every button with a network round trip shows a spinner** —
  `components/ui/Spinner.tsx`, paired with a changed label. Don't ship a
  button whose pending state is invisible.
- **Pagination**: Supabase's REST API silently caps `.select()` at 1,000
  rows. `lib/reports/queries.ts`'s `selectAllRows` pages through the full
  table in parallel once the count is known — use it for any full-table
  report query.
- **Audit logging**: one `logAuditEvent` call per report *view* (not per
  row), started concurrently with the actual data fetch and awaited at the
  end, not blocking the fetch.

## Required configuration (names only — real values live in Vercel's
Environment Variables and in Supabase's own project settings, never in
this repo or in chat)

See `.env.example` for the authoritative list and generation notes. Summary:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key (RLS-scoped) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key — server-only, bypasses RLS |
| `NEXT_PUBLIC_APP_URL` | Deployed app URL (used for invite/password-set redirects) |
| `MS_GRAPH_TENANT_ID` / `MS_GRAPH_CLIENT_ID` / `MS_GRAPH_CLIENT_SECRET` | Entra ID app registration for the Microsoft Graph connection |
| `MS_GRAPH_REDIRECT_URI` | OAuth2 callback URL for the Graph connect flow |
| `GRAPH_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key encrypting Graph refresh tokens at rest |
| `CRON_SECRET` | Shared secret Vercel Cron sends to `/api/graph/sync` |

## Current status / what we're working on

Shipped and in production use: auth + MFA, RLS-scoped reporting across five
dashboard pages, manual spreadsheet upload (the primary import path),
admin-managed staff accounts (invite, role, deactivate, delete-if-pending,
password reset), a 24-hour hard session lifetime, and the loan-matching
fixes described above.

Open items, in rough priority order:

- **Microsoft Graph live sync is built but not connected** — blocked on the
  client's Microsoft 365 tenant admin approving the app registration.
  Manual upload is the working path in the meantime; the cron job and
  sync code are ready to go once that consent happens.
- **No custom SMTP configured** — Supabase's shared email sender has a very
  low rate limit, so invite emails can fail under normal use. Needs a
  provider (Resend was the recommended option) wired into Supabase's Auth
  SMTP settings.
- **Supabase is on the free tier** — no point-in-time recovery, minimal
  backup retention. Real client data is already live in it. This is a plan
  decision for the client, not something fixable in code.
- **No independent security review has been done.** Everything here was
  built and self-checked by Claude in this repository; that is not the
  same as adversarial review, which this kind of data warrants before full
  reliance.
- **No data retention/deletion tooling** — the Privacy Act gives clients
  rights here; currently any retention/deletion action would be a manual
  SQL operation, not a built workflow.
- **Vercel deploys production from `main`.** Changes go in through pull
  requests into `main`. The original branch
  (`claude/mortgage-reporting-platform-hjbpxk`) was merged into `main` and
  is no longer what production tracks. Note that after a Vercel Instant
  Rollback, new production builds are not auto-promoted until a
  deployment is promoted manually.
