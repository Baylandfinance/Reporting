# Architecture

```
Excel Online (M365 tenant)
        │  Microsoft Graph API (delegated, Files.Read.All + offline_access)
        ▼
Next.js app (Vercel, syd1)  ──────────────┐
        │  Supabase JS (anon key, RLS-scoped)   │  Supabase JS (service-role key,
        ▼                                        │  server-only: sync job, admin actions,
Supabase Postgres (Sydney, ap-southeast-2)  ◄─────┘  audit log writes)
  - RLS enforces per-broker access
  - Supabase Auth: email/password + TOTP MFA
```

## Why this stack

- **Next.js on Vercel**: server components mean report queries run
  server-side against Supabase with the user's own session — a browser
  never gets a Supabase key wide enough to see another broker's data,
  because RLS is the enforcement point, not app code.
- **Supabase**: Postgres + Auth + Row Level Security in one place, with an
  explicit Australian region. RLS is what actually implements the RBAC
  model — see `docs/COMPLIANCE.md` and the migrations for the policy
  detail.
- **Microsoft Graph**: the only supported way to read Excel Online live
  without exporting files by hand. Delegated auth (not app-only) so the
  access is tied to a real consenting user's permissions, not a
  standing service account with tenant-wide reach.

## Data flow

1. An admin connects a Microsoft 365 account via `/api/graph/connect`
   (OAuth2 authorization code flow). The refresh token is encrypted
   (AES-256-GCM, `lib/graph/crypto.ts`) before it's stored in
   `graph_connections`.
2. `/api/graph/sync` (admin-triggered for now) exchanges the refresh token
   for a short-lived access token, reads the configured worksheet's used
   range via Graph, and upserts `clients`, `loans` and `loan_commissions`
   — see `docs/SETUP.md` for the exact column mapping against the real
   workbook.
3. Report pages (`app/dashboard/**`) query Supabase through the
   **anon-key** server client (`lib/supabase/server.ts`'s `createClient`),
   so every read is subject to RLS. `lib/reports/queries.ts` holds the
   aggregation logic and logs one audit event per report view.
4. Admin actions (role changes, deactivation, the Graph connection/sync)
   go through the **service-role** client, which bypasses RLS by design —
   these routes each call `requireRole("admin")` first as the
   application-level check that stands in front of that broader access.

## Where RBAC actually lives

Not in `middleware.ts`, and not in page components — those are UX
conveniences (redirect to `/login`, hide the admin nav item). The real
boundary is `supabase/migrations/0002_rls_policies.sql`: even a
compromised or buggy page component cannot make Postgres return rows it
isn't allowed to. If you add a new table that holds client data, write its
RLS policy before writing the page that queries it, not after.

## Extending the schema

`pipeline_stages`, `lenders`, `lead_sources` and `brokerages` are plain
tables, not enums — new values are expected to appear from the Excel sync
and get created on the fly (see `app/api/graph/sync/route.ts`'s
`findOrCreateByName`). If you add a genuinely fixed set of values (roles,
client types), a Postgres enum is fine — the difference is whether the
business is likely to invent a new one of these next month.
