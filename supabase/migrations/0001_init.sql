-- Bayland Finance Reporting — core schema
-- Shaped directly against a sample of the real "Application Management"
-- workbook (36 columns, ~3,500 rows) rather than a generic guess. Notable
-- decisions driven by what that data actually looks like:
--
--   * Status/pipeline stage has 30 distinct raw values in the sample
--     (mixed casing: "Hold"/"hold", genuine stages: Settled/Lost/Active/
--     Follow up/Warm/Planned solution/...). A fixed Postgres enum would
--     break the first time a new status shows up, so pipeline_stages is a
--     normal table the sync can insert into and an admin can reclassify —
--     not a hard-coded enum.
--   * "Transaction Type" has 593 distinct free-text values in the sample
--     ("Purchase", "FHB Purchase", "new eview office to call", ...). It is
--     stored as-is (transaction_type_raw) rather than force-classified —
--     see clients.client_type below for why.
--   * client_type (owner-occupier/investor/commercial) is nullable. It is
--     NOT auto-guessed from the messy transaction-type text: silently
--     mis-bucketing an investor loan as owner-occupier is a compliance
--     risk (serviceability/rate treatment differs), not just a cosmetic
--     one. Unclassified clients show up as "Unclassified" in reports until
--     someone sets it deliberately.
--   * Brokerage is its own table — the sample data spans multiple brands
--     (Bayland, Tango, MLB, ...), not one single business.
--   * Loan Administrator / Parabroker / Processor are stored as plain text
--     labels on the loan, not linked to platform accounts — the sample
--     data has no reliable way to match these free-text names to an actual
--     staff login, and forcing that match wrong would misattribute access.
--     owner_broker_id (the "Broker" column) is what actually drives RLS.
--   * Dates arrive from Excel as serial-day numbers; the sync converts
--     them to real dates before they ever reach this schema — Postgres
--     date columns throughout, never a raw serial number.

create extension if not exists "pgcrypto";

create type user_role as enum ('admin', 'broker', 'assistant');
create type client_type as enum ('owner_occupier', 'investor', 'commercial');
create type pipeline_stage_category as enum ('lead', 'active', 'on_hold', 'settled', 'lost');
create type au_state as enum ('vic', 'nsw', 'qld', 'sa', 'wa', 'tas', 'nt', 'act');

-- One row per authenticated staff member, mirroring auth.users.
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'broker',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table brokerages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table lenders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- The channel a lead came through ("Lead Origination" in the source sheet:
-- Existing client, Eview, BNI, Website, ...) — distinct from the named
-- individual who referred a specific client, which is free text on the
-- client record since it isn't a clean, bounded list in the source data.
create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

-- Admin-editable, not a fixed enum — see the file header for why. Seeded
-- in 0003_seed_reference_data.sql with a cleaned-up version of the
-- distinct values actually found in the sample workbook.
create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category pipeline_stage_category not null default 'active',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  client_type client_type, -- nullable: "Unclassified" until a human sets it deliberately
  lead_source_id uuid references lead_sources (id),
  referrer_name text, -- free text; the named individual referrer, if any
  owner_broker_id uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_owner_name_unique unique (owner_broker_id, full_name)
);

create table loans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients (id) on delete cascade,
  lender_id uuid references lenders (id),
  brokerage_id uuid references brokerages (id),
  owner_broker_id uuid not null references profiles (id), -- the "Broker" column; drives RLS
  pipeline_stage_id uuid references pipeline_stages (id),
  transaction_type_raw text, -- kept verbatim; see file header
  property_state au_state,
  loan_amount numeric(14, 2),
  interest_rate numeric(5, 3), -- not present in the source sheet; manual/future use
  loan_administrator_name text,
  parabroker_name text,
  processor_name text,
  enquiry_date date,
  quote_date date,
  application_date date,
  submission_date date,
  conditional_approval_date date,
  unconditional_approval_date date,
  settlement_booked_date date,
  settlement_date date,
  comment text,
  source_row_ref text unique, -- Excel Online row/sheet reference; also the sync's upsert key
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per loan (not one row per commission event) — this mirrors the
-- source sheet's own shape, where each loan has one set of commission
-- figures rather than a list of discrete commission line items.
create table loan_commissions (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null unique references loans (id) on delete cascade,
  commission_received_date date,
  upfront_commission numeric(12, 2),
  trail_commission numeric(12, 2),
  referral_upfront_split_pct numeric(5, 2),
  referral_trail_split_pct numeric(5, 2),
  broker_upfront_commission numeric(12, 2),
  broker_trail_commission numeric(12, 2),
  referral_upfront_commission numeric(12, 2),
  referral_trail_commission numeric(12, 2),
  commission_payment_date date,
  referral_commission_payment_date date,
  clawback_amount numeric(12, 2),
  clawback_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Append-only audit trail. No update/delete grants are given anywhere in
-- this migration — see 0002_rls_policies.sql — so the log is tamper-evident
-- for as long as the service-role key itself is not compromised.
create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references profiles (id),
  action text not null,
  resource_type text not null,
  resource_id text,
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  created_at timestamptz not null default now()
);

-- Encrypted Microsoft Graph refresh tokens for the Excel Online live sync.
-- The token itself is encrypted application-side (AES-256-GCM) before it
-- ever reaches this table — Postgres/Supabase never sees the plaintext.
create table graph_connections (
  id uuid primary key default gen_random_uuid(),
  connected_by uuid not null references profiles (id),
  tenant_id text not null,
  drive_item_id text not null,
  worksheet_names jsonb not null default '[]'::jsonb,
  encrypted_refresh_token text not null,
  token_iv text not null,
  token_auth_tag text not null,
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);

create index loans_owner_broker_idx on loans (owner_broker_id);
create index loans_client_idx on loans (client_id);
create index loans_pipeline_stage_idx on loans (pipeline_stage_id);
create index clients_owner_broker_idx on clients (owner_broker_id);
create index loan_commissions_loan_idx on loan_commissions (loan_id);
create index audit_log_actor_idx on audit_log (actor_id);
create index audit_log_resource_idx on audit_log (resource_type, resource_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger clients_set_updated_at
  before update on clients
  for each row execute function set_updated_at();

create trigger loans_set_updated_at
  before update on loans
  for each row execute function set_updated_at();

create trigger loan_commissions_set_updated_at
  before update on loan_commissions
  for each row execute function set_updated_at();

-- New Supabase auth users default to the least-privileged role. An admin
-- must explicitly promote a profile — nobody self-elevates by signing up.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), new.email, 'assistant');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
