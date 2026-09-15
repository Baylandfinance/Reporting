# Bayland Finance Reporting

Internal reporting and analytics platform for Bayland Finance, replacing
the Microsoft BI + online Excel workflow. Next.js + Supabase (Postgres,
Auth, Row Level Security) + Microsoft Graph for a live Excel Online sync.

**Read before deploying with real client data:**

- [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md) — Privacy Act / NCCP / Notifiable
  Data Breaches posture, and what's explicitly out of scope. Not legal
  advice — have it checked.
- [`docs/SECURITY.md`](docs/SECURITY.md) — auth, RBAC, secrets handling, and
  known gaps.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the pieces fit
  together and where access control actually lives.
- [`docs/SETUP.md`](docs/SETUP.md) — step-by-step: Supabase project
  (Sydney region), your first admin account, Vercel deploy, Microsoft
  Graph app registration, and the exact Excel column mapping.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Graph values, see docs/SETUP.md
npm run dev
```

## What's here

- **Auth**: email/password + mandatory TOTP MFA (Supabase Auth).
- **RBAC**: `admin` / `broker` / `assistant`, enforced by Postgres RLS —
  a broker only ever sees their own clients and loans.
- **Reports**: Pipeline & Settlements, Commissions, Lenders & Products,
  Clients & Referrals — each reading live from Supabase, empty-state aware
  until real data is loaded.
- **Excel Online sync**: `/api/graph/connect` + `/api/graph/sync`, mapped
  against the real "Application Management" workbook columns (see
  `docs/SETUP.md`).
- **Audit log**: every report view, role change, deactivation, and sync
  run recorded, admin-readable only, insert-only.

## What's not here yet

See "Known gaps" in `docs/SECURITY.md` and "What this platform does NOT
do" in `docs/COMPLIANCE.md` — both are deliberately explicit about the
difference between "built" and "production-ready for real client PII."
