# Compliance posture

This describes how the platform is built to support Bayland Finance's
obligations under the Privacy Act 1988 (Cth) and the National Consumer
Credit Protection Act 2009 (Cth). **It is not legal advice.** Get this
reviewed by your compliance consultant or lawyer before it holds real
client data, and before you rely on it in an ASIC or OAIC conversation.

## Why this business is in scope at all

Mortgage brokers are usually assumed to dodge the Privacy Act's small
business exemption (turnover under $3M). That assumption is wrong here:
because you handle credit-related personal information as a credit
provider/broker, Part IIIA of the Privacy Act (the credit reporting
regime) and the Notifiable Data Breaches scheme apply to you regardless of
turnover. Build and operate this platform as if the full Privacy Act
applies — because it does.

## Data minimisation and access control

- **Role-based access (RBAC)**: three roles — `admin`, `broker`,
  `assistant` — enforced by Postgres Row Level Security, not just app code.
  A broker can only read or write clients/loans where they are the
  `owner_broker_id`. This is the direct implementation of APP 6 (use and
  disclosure limited to the purpose for which information was collected):
  a broker has no business reason to browse a colleague's client file, so
  the database won't let them.
- **Assistants** currently get read-only visibility across the whole book,
  on the assumption support staff need to help any broker. If that's not
  true of how you actually run the business, narrow
  `supabase/migrations/0002_rls_policies.sql` before onboarding anyone into
  that role — least privilege means matching the policy to the real job,
  not the default.
- **Admin** is full access, including user management. Reserve it for the
  license holder(s) actually accountable for the business, not a
  convenience role for staff.

## Authentication

- Email + password plus mandatory TOTP (authenticator app) multi-factor
  authentication. The middleware (`lib/supabase/middleware.ts`) blocks
  every `/dashboard` route unless the session has reached `aal2` (MFA
  satisfied) — there is no page that's reachable with password-only auth.
- Deactivating a staff account (`Users & Access`) both flips a database
  flag checked by every RLS policy and bans the underlying Supabase auth
  user, so access is revoked immediately rather than "once their session
  token expires."

## Audit trail

- `audit_log` records every report view, every role change, every user
  deactivation, and every Graph sync, with actor, timestamp, and IP. It is
  insert-only — no update or delete policy exists on the table — so it
  can't be quietly edited after the fact by anyone short of someone with
  the Supabase project's own admin credentials.
- Supabase Auth separately maintains `auth.audit_log_entries`, which
  already covers sign-in, sign-out, and MFA challenge events — this
  platform's own `audit_log` intentionally doesn't duplicate that; it
  focuses on access to business data.
- This combination is what lets you reconstruct "who looked at this
  client's file, and when" — the evidence a Notifiable Data Breach
  assessment or an ASIC record-keeping request will actually ask for.

## Data residency and cross-border disclosure (APP 8)

You chose Supabase + Vercel. Both can be configured for Australian data
residency, but neither defaults to it:

- **Supabase**: when creating the project, set the region to
  **Sydney (ap-southeast-2)** explicitly. This is a one-time choice made at
  project creation and cannot be changed later without migrating to a new
  project.
- **Vercel**: the app itself is stateless (no data stored on Vercel), but
  serverless function execution region affects latency to your
  Australian-region Supabase project, not residency of the data at rest.
  Set the function region to `syd1` in `vercel.json` or project settings so
  data in transit doesn't unnecessarily route through a US or EU point of
  presence.
- **Microsoft Graph**: your Excel Online data already lives wherever your
  Microsoft 365 tenant's region is (check this in the Microsoft 365 admin
  center — most Australian business tenants are AU-region, but verify
  rather than assume). Once synced into Supabase, it inherits the Supabase
  project's region.

If you ever consider a different host, re-check this section — it's the
one thing that's expensive to fix after the fact.

## Retention

No automatic deletion is implemented in this first version. NCCP
responsible-lending record-keeping expectations (RG 209) and typical
professional indemnity requirements point toward multi-year retention (get
your specific retention period confirmed with your compliance adviser —
this varies and isn't something to guess at). Decide the number, then
implement it deliberately rather than defaulting to "keep everything
forever" or auto-deleting on a schedule nobody signed off on.

## Data breach response

You are covered by the Notifiable Data Breaches scheme (see above). Before
this platform holds real client data, have a written response plan
covering: who assesses whether a breach is "eligible" (likely to cause
serious harm), the OAIC notification process, and how affected clients get
told. The OAIC publishes a
[data breach response plan template](https://www.oaic.gov.au/privacy/notifiable-data-breaches/preventing-and-preparing-for-a-data-breach) —
adapt it rather than starting from a blank page.

## What this platform does NOT do

Being explicit about the gaps matters more than pretending they're
covered:

- No automated data retention/deletion policy.
- No client-facing privacy notice generator — your existing Privacy Policy
  and Credit Guide need to reflect that client data now flows through this
  platform.
- No penetration test has been performed. Before this goes live with real
  client data, get an independent security review — this build is a solid
  foundation, not a substitute for one.
- No SOC 2 / ISO 27001 attestation — inherited from Supabase/Vercel's own
  posture, not something this codebase adds.
