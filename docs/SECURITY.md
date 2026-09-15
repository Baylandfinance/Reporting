# Security

## Authentication

- Email + password, Supabase Auth (bcrypt-hashed, never touched by app
  code).
- Mandatory TOTP MFA. `lib/supabase/middleware.ts` blocks every
  `/dashboard` route unless the session's authenticator assurance level is
  `aal2` — there is no page reachable with password-only auth once a
  factor is enrolled, and new accounts are forced through `/mfa-enroll`
  before they can reach anything else.
- Session cookies are httpOnly, managed entirely by `@supabase/ssr` — no
  token ever touches `localStorage` or app-readable JS.

## Authorization

- Enforced by Postgres Row Level Security, not application code — see
  `docs/ARCHITECTURE.md` and the migrations. Three roles: `admin`,
  `broker`, `assistant`.
- Deactivating a user (`Users & Access`) both flips `profiles.is_active`
  (checked by every RLS policy) and bans the underlying Supabase auth user
  via the admin API — access is revoked immediately, not on token expiry.

## Secrets

- `SUPABASE_SERVICE_ROLE_KEY`, `MS_GRAPH_CLIENT_SECRET`,
  `GRAPH_TOKEN_ENCRYPTION_KEY`, and `CRON_SECRET` are server-only
  environment variables —
  never referenced from a client component, never prefixed
  `NEXT_PUBLIC_`. Only `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` are meant to reach the browser (the anon
  key is safe there by design — RLS is what actually restricts it).
- Microsoft Graph refresh tokens are encrypted (AES-256-GCM) before
  storage, with a key that lives only in the deployment environment's
  variables, never in the repository. `.env` and `.env*.local` are
  git-ignored; `.env.example` documents names only, no values.
- Rotate `MS_GRAPH_CLIENT_SECRET` on Azure's own expiry schedule (default
  6-24 months) and update the Vercel environment variable — nothing in
  this codebase reminds you to do this, so put it on a calendar.

## Transport and browser hardening

`next.config.mjs` sets `Strict-Transport-Security`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a restrictive
`Permissions-Policy` on every response. Vercel terminates TLS; there is no
path where this app serves plain HTTP in production.

## Audit trail

`audit_log` (append-only, admin-read-only, no update/delete policy at all)
records report views, role changes, deactivations, and Graph sync runs.
Supabase's own `auth.audit_log_entries` separately covers sign-in/out and
MFA events. Together these are what let you answer "who accessed this
client's data, and when" after the fact.

## Known gaps — read this before going live with real client data

- **No independent security review has been performed.** This is a
  carefully-built foundation, not a substitute for a penetration test or
  a second engineer's review. Get one before real client PII sits in it.
- **No rate limiting on `/login`.** Supabase Auth has some built-in abuse
  protection, but a dedicated brute-force/credential-stuffing control
  (e.g. Vercel's WAF rules, or a rate-limit middleware) isn't configured
  here yet.
- **Both import paths trust the sheet.** A malformed row in an uploaded
  file or the synced workbook won't corrupt other clients' data (RLS still
  scopes everything to the matched `owner_broker_id`), but there's no
  schema validation library (e.g. Zod) on the incoming values beyond basic
  type coercion — tighten this before opening either import path to more
  than a trusted admin.
- **Uploaded-file parsing uses `exceljs`, not the npm `xlsx` package** —
  the latter has two unpatched high-severity advisories (prototype
  pollution, ReDoS) with no fix on the npm registry, and this feature
  parses admin-uploaded files, i.e. attacker-controllable input in
  principle. `exceljs` carries one moderate, non-applicable-to-our-usage
  advisory (a `uuid` bounds check on an internal ID it generates itself,
  never on file content). Re-check both packages' advisories before
  upgrading either.
- **The scheduled sync endpoint (`GET /api/graph/sync`) is protected by
  `CRON_SECRET`, not a user session** — anyone who obtains that value can
  trigger a sync. Treat it with the same care as the other server-only
  secrets above.
- **No automated dependency/vulnerability scanning wired up** (e.g.
  Dependabot, `npm audit` in CI). Turn this on in the repository settings.
- **No backup/restore drill has been run.** Supabase takes automatic
  backups on paid tiers — confirm the plan you're on actually includes
  them, and test a restore at least once before you need it for real.

If a client's data is ever exposed, lost, or accessed without
authorization, that's a Notifiable Data Breach scheme event — see
`docs/COMPLIANCE.md`. Know the process before you need it.
