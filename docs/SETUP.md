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
2. In Supabase, go to **Authentication → URL Configuration** and set the
   **Site URL** to your deployed app's URL (e.g. the Vercel URL, or your
   custom domain once wired up). This is where Supabase sends people after
   they click an invite or password-reset link — if it's wrong or left as
   `localhost`, invited staff land nowhere.
3. Use Supabase's dashboard (**Authentication → Users → Add user**) to
   create your own account with your real name and email. There is no
   self-service sign-up page in the app — deliberately, since open
   registration isn't appropriate for a staff-only platform holding client
   data.
4. Sign in, complete MFA enrollment.
5. In the Supabase SQL editor, promote yourself to admin (new accounts
   default to the lowest-privilege role):
   ```sql
   update profiles set role = 'admin' where email = 'you@baylandfinance.com.au';
   ```
6. From then on, manage everyone else's role from **Users & Access** in
   the app — you shouldn't need the SQL editor again for this.

## Adding other staff afterwards

Once you're set up as admin, for every new staff member:

1. Supabase dashboard → **Authentication → Users → Add user → Invite
   user**. Enter their email — don't set a password yourself. Supabase
   emails them a link to `/auth/set-password` on your Site URL, where they
   choose their own password nobody else ever sees, then complete MFA
   enrollment.
2. Once they've logged in for the first time (their profile row now
   exists), go to **Users & Access** in the app and set their role. New
   accounts default to `assistant` — the lowest-privilege role — until an
   admin promotes them.

If you use "Add user" → "Create new user" instead of "Invite user", you set
their password yourself and would need to pass it to them some other way —
prefer the invite flow so passwords are never shared over email or chat.

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

## 4. Register the Microsoft Graph app (for automatic Excel Online sync)

Only needed for the automatic, twice-daily connection. The **Import Data →
Upload spreadsheet** button works today with no Microsoft setup at all —
use that first, and come back to this once someone with Microsoft 365
admin rights is available. This step happens in your Microsoft 365 tenant,
not in this codebase — you need Global Administrator or Application
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
   `MS_GRAPH_*` environment variables, and set `CRON_SECRET` to any random
   string (`openssl rand -base64 32` again).
7. As an admin in the platform, go to **Import Data** and click **Connect
   Microsoft 365 account** — this starts the Microsoft consent flow. Sign
   in with an account that has read access to the loan tracker workbook.
8. Back on **Import Data**, paste the workbook's sharing link (in Excel
   Online or SharePoint: **Share → Copy link**) into the box and click
   **Save**. The app resolves the link to the actual file via Microsoft
   Graph's Shares API automatically — no Graph Explorer, no hunting for an
   item ID by hand.
9. Click **Sync now** to run it once immediately. Rows still import even
   if a "Broker" name doesn't match a staff account yet — they land as
   unattributed (visible to admins, not tied to a specific broker's own
   book) rather than being skipped. The results panel groups these by
   name so you can see at a glance which staff accounts are still worth
   creating, without blocking the import on it.
10. From then on it also runs automatically once a day (`vercel.json`'s
    `crons` block — currently ~7am Melbourne time; shifts by an hour across
    daylight saving since Vercel Cron runs on UTC). **This is set to once,
    not twice, a day on purpose:** Vercel's free "Hobby" plan rejects a
    twice-daily schedule outright (the deploy itself fails, not just a
    missed run). If you want genuine twice-daily automatic syncing, that
    needs a paid Vercel plan — change the `schedule` in `vercel.json` to
    `"0 21,7 * * *"` once you've upgraded. Until then, the **Sync now**
    button on the Import Data page covers the gap — click it whenever you
    want an up-to-date pull outside the daily automatic run.

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

`Client Name` and `Status` must be present for a row to import at all.
`Broker` should be present too, but if its value doesn't match a staff
account's `full_name` in **Users & Access**, the row still imports —
it's saved as "unattributed" (visible to admins, not yet counted as any
specific broker's own book) rather than being skipped. Everything else is
optional and left blank if missing.

**How re-uploading the same loan is recognised.** There's no unique ID
column in the sheet, so a loan is identified by `Client Name` + `Broker` +
`Lender` + its earliest recorded date (`Enquiry Date`, falling back to
`Application Date`, then `Quote Date`). Re-uploading updates that same
loan's row rather than creating a duplicate, as long as those fields stay
the same between uploads. If the same client has more than one loan with
the same broker and lender (repeat business), each one beyond the first is
still kept as a separate row rather than merged — but which of those
repeat loans is "the first" vs "the second" is decided by their order in
the sheet, so keep them in a consistent order across uploads. Two
consequences worth knowing:

- If the same client approaches the same broker for the same lender a
  second time with none of those three dates filled in yet, fill in at
  least `Enquiry Date` as early as possible — it's the most reliable way
  to keep repeat loans matched to the right row on every re-upload.
- Correcting a typo in `Client Name`, `Broker`, or `Lender` after the fact
  creates a new loan record instead of updating the existing one — fix
  those directly in the app once imported, not by re-uploading a corrected
  sheet.

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
