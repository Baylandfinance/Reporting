# Setup

Do these in order. Nothing here touches real client data until the very
last step (connecting Excel Online and running a sync) — everything before
that is infrastructure you can set up and sanity-check safely.

## 1. Create the Supabase project

1. [supabase.com](https://supabase.com) → New Project.
2. **Region: Sydney (ap-southeast-2).** This cannot be changed later —
   double-check it before clicking create. See `docs/COMPLIANCE.md` for why
   this matters.
3. Once created, run the migrations in `supabase/migrations/` in order
   (via the SQL editor, or `supabase db push` with the CLI linked to this
   project). They create the schema, RLS policies, and seed the pipeline
   stage list.
4. In **Authentication → Providers**, leave email/password on. In
   **Authentication → Multi-factor**, enable **TOTP** — the app enforces it
   in code, but it must also be enabled at the project level for enrollment
   to work.
5. Copy the project URL, anon key, and service role key into your `.env`
   (see `.env.example`).

## 2. Create your own account

1. Run the app locally (`npm install && npm run dev`) or deploy it first —
   either works.
2. Go to `/login` and use Supabase's dashboard (**Authentication → Users
   → Add user**) to create your own account with your real name and email,
   or wire up a temporary sign-up form — there isn't one in the UI yet,
   since self-service sign-up isn't appropriate for a staff-only platform.
3. Sign in, complete MFA enrollment.
4. In the Supabase SQL editor, promote yourself to admin (new accounts
   default to the lowest-privilege role):
   ```sql
   update profiles set role = 'admin' where email = 'you@baylandfinance.com.au';
   ```
5. From then on, manage everyone else's role from **Users & Access** in
   the app — you shouldn't need the SQL editor again for this.

## 3. Deploy to Vercel

1. Import this repository into Vercel.
2. Set every variable from `.env.example` in **Project Settings →
   Environment Variables**. Generate `GRAPH_TOKEN_ENCRYPTION_KEY` with
   `openssl rand -base64 32` — do this once and keep it; losing it makes
   any stored Graph refresh token unreadable.
3. `vercel.json` pins serverless functions to the Sydney region
   (`syd1`) — leave this as-is.
4. Deploy. Update `NEXT_PUBLIC_APP_URL` to the real deployed URL and
   redeploy (some auth redirects depend on it).

## 4. Register the Microsoft Graph app (for live Excel Online sync)

Only needed if you want the live-connection option rather than periodic
manual export/import. This step happens in your Microsoft 365 tenant, not
in this codebase — you need Global Administrator or Application
Administrator rights in Entra ID (Azure AD) to do it.

1. [entra.microsoft.com](https://entra.microsoft.com) → **App
   registrations → New registration**.
2. Name it (e.g. "Bayland Reporting — Excel sync"). Supported account
   types: **Accounts in this organizational directory only**.
3. Redirect URI: **Web**, `https://<your-app-domain>/api/graph/callback`.
4. **API permissions** → Add → Microsoft Graph → **Delegated permissions**
   → add `Files.Read.All` and `offline_access`. Grant admin consent for
   these two — nothing broader. Widening this later needs a deliberate
   decision, not a default.
5. **Certificates & secrets** → New client secret. Copy the value
   immediately (Azure only shows it once).
6. Put the tenant ID, application (client) ID, and client secret into the
   `MS_GRAPH_*` environment variables.
7. As an admin in the platform, visit `/api/graph/connect` — this starts
   the Microsoft consent flow. Sign in with an account that has read
   access to the loan tracker workbook.
8. After consenting, a row is created in `graph_connections` with a
   placeholder `drive_item_id`. Find the real one: open the workbook in
   Excel Online, and either use the Graph Explorer
   (`https://developer.microsoft.com/graph/graph-explorer`) to call
   `GET /me/drive/root:/path/to/Application Management.xlsx` and copy the
   `id` field, or ask whoever manages the SharePoint/OneDrive site. Update
   the row:
   ```sql
   update graph_connections
   set drive_item_id = '<the real item id>', worksheet_names = '["Sheet1"]'
   where id = '<the row id from step 7>';
   ```
   (Replace `Sheet1` with the actual worksheet/tab name if different.)
9. Trigger a sync by POSTing to `/api/graph/sync` (as a signed-in admin —
   e.g. from the browser console on the app's own origin, or wire up a
   button later). Check the JSON response's `errors` array before trusting
   the numbers — it lists exactly which rows didn't map and why (usually:
   a broker name in the sheet that doesn't match any staff account's
   `full_name` in **Users & Access** — fix the mismatch on either side and
   re-run).

## Excel Online sheet format

The sync reads the workbook's used range on the configured worksheet and
expects **row 1 to be column headers** matching (case-insensitive, order
doesn't matter) the columns already in your "Application Management"
sheet:

`Client Name`, `Referrer`, `Lead Origination`, `Transaction Type`,
`Status`, `State`, `Lender`, `Loan_Amount`, `Brokerage`, `Broker`,
`Loan Administrator`, `Parabroker`, `Processor`, `Enquiry Date`,
`Quote Date`, `Application Date`, `Submission Date`,
`Conditional Approval Date`, `Unconditional Approval Date`,
`Settlement Booked Date`, `Settlement Date`, `Commission Received`,
`Upfront Commission`, `Trail Commission`,
`Refferal Upfront Commission Split`, `Refferal Trail Commission Split`,
`Broker Upfront Commission`, `Broker Trail Commission`,
`Referral Upfront Commission`, `Referral Trail Commission`,
`Commission Payment Date`, `Refferal Commission Payment Date`,
`Clawback`, `Clawback Date`, `Comment`.

Only `Client Name`, `Status` and `Broker` are strictly required for a row
to sync at all — everything else is optional and left blank if missing.

Things worth cleaning up in the source sheet before relying on this
long-term (found in the sample you provided, not hypothetical):

- **`Status` had 30 distinct values** including case duplicates (`Hold` /
  `hold`, `Lost` / `lost`). The sync matches case-insensitively against
  `pipeline_stages`, so `hold` and `Hold` become the same stage — but new,
  never-seen statuses get auto-created with category `active` by default.
  Check **Admin → Pipeline stages** (not yet built as a UI — currently the
  Supabase table directly) after your first sync and recategorise anything
  that landed in the wrong bucket, especially anything that's actually
  settled or lost.
- **`State` had inconsistent casing** (`VIC`, `Vic`, `vic`) and a few `--`
  placeholders. Normalised automatically; unrecognised values are stored
  as no state rather than guessed.
- **`Referral fee` column** in the sample mixes lead-temperature notes
  ("Hot", "Warm") and people's first names — it isn't a clean, single-
  purpose field, so the sync does not import it at all. If commission
  splits to referrers matter to you, that needs a real decision on what
  this column is actually meant to track before it's worth building
  against.
- **Client type (owner-occupier / investor / commercial) is never
  auto-set** from `Transaction Type`, deliberately — see
  `docs/COMPLIANCE.md`. New synced clients show as "Unclassified" in
  reports until someone sets this manually against the actual client file.

## 5. First real report check

Once a sync has run, open `/dashboard` as your admin account and as a
`broker`-role test account, and confirm the broker only sees their own
book. That's the one thing worth manually verifying yourself before
anyone else logs in — everything else is enforced by the database, but
"I configured RLS correctly" deserves a real check, not just trust in the
migration file.
