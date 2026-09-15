-- Row Level Security — the real access-control boundary for this app.
-- The Next.js server only ever queries through the anon key on behalf of
-- the signed-in user; these policies are what actually stop a broker from
-- reading another broker's client file, not application code.

alter table profiles enable row level security;
alter table brokerages enable row level security;
alter table lenders enable row level security;
alter table lead_sources enable row level security;
alter table pipeline_stages enable row level security;
alter table clients enable row level security;
alter table loans enable row level security;
alter table loan_commissions enable row level security;
alter table audit_log enable row level security;
alter table graph_connections enable row level security;

create or replace function current_role_is(target user_role)
returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = target and is_active
  );
$$ language sql stable security definer set search_path = public;

create or replace function is_admin()
returns boolean as $$
  select current_role_is('admin');
$$ language sql stable security definer set search_path = public;

-- Deactivating a profile (app.dashboard/admin/users) also bans the
-- underlying auth user, but this is the belt on top of that suspenders:
-- even if a session token is still technically valid, every RLS check
-- below requires is_active so a deactivated account reads and writes
-- nothing, including its own former book.
create or replace function is_active_user()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and is_active
  );
$$ language sql stable security definer set search_path = public;

-- ---- profiles ----
-- Everyone can read their own profile; admins can read and manage all
-- profiles (needed for the Users & Access admin screen).
create policy "profiles_self_read" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "profiles_admin_write" on profiles
  for update using (is_admin());

-- Deliberately no insert policy for authenticated users: rows are created
-- only by the handle_new_user() trigger (security definer), never directly.

-- ---- reference data (brokerages / lenders / lead_sources / pipeline_stages) ----
-- Read-only to all signed-in staff; only admins maintain it. The sync job
-- (service-role key, bypasses RLS entirely) is what actually auto-creates
-- new lenders/lead sources/pipeline stages as they appear in the sheet.
create policy "brokerages_read_all" on brokerages
  for select using (auth.uid() is not null);

create policy "brokerages_admin_write" on brokerages
  for all using (is_admin()) with check (is_admin());

create policy "lenders_read_all" on lenders
  for select using (auth.uid() is not null);

create policy "lenders_admin_write" on lenders
  for all using (is_admin()) with check (is_admin());

create policy "lead_sources_read_all" on lead_sources
  for select using (auth.uid() is not null);

create policy "lead_sources_admin_write" on lead_sources
  for all using (is_admin()) with check (is_admin());

create policy "pipeline_stages_read_all" on pipeline_stages
  for select using (auth.uid() is not null);

create policy "pipeline_stages_admin_write" on pipeline_stages
  for all using (is_admin()) with check (is_admin());

-- ---- clients ----
-- Admins see every client. Brokers see only clients they own — this is the
-- "need to know" boundary the Privacy Act's APP 6 (use/disclosure limited
-- to the purpose collected) and NCCP responsible-lending record-keeping
-- both point to: a broker has no legitimate reason to browse a colleague's
-- client file. Assistants get read-only visibility across the book so they
-- can support any broker's file without being able to alter it — narrow
-- this further per real staff duties before onboarding non-admin users.
create policy "clients_owner_or_admin_read" on clients
  for select using (
    is_active_user() and (
      owner_broker_id = auth.uid()
      or is_admin()
      or current_role_is('assistant')
    )
  );

create policy "clients_owner_write" on clients
  for insert with check (
    is_active_user() and (owner_broker_id = auth.uid() or is_admin())
  );

create policy "clients_owner_update" on clients
  for update using (
    is_active_user() and (owner_broker_id = auth.uid() or is_admin())
  );

-- ---- loans ----
create policy "loans_owner_or_admin_read" on loans
  for select using (
    is_active_user() and (
      owner_broker_id = auth.uid()
      or is_admin()
      or current_role_is('assistant')
    )
  );

create policy "loans_owner_write" on loans
  for insert with check (
    is_active_user() and (owner_broker_id = auth.uid() or is_admin())
  );

create policy "loans_owner_update" on loans
  for update using (
    is_active_user() and (owner_broker_id = auth.uid() or is_admin())
  );

-- ---- loan_commissions ----
-- Visibility follows the parent loan's ownership.
create policy "loan_commissions_via_loan_read" on loan_commissions
  for select using (
    is_active_user() and exists (
      select 1 from loans l
      where l.id = loan_commissions.loan_id
        and (l.owner_broker_id = auth.uid() or is_admin() or current_role_is('assistant'))
    )
  );

create policy "loan_commissions_via_loan_write" on loan_commissions
  for all using (
    is_active_user() and exists (
      select 1 from loans l
      where l.id = loan_commissions.loan_id
        and (l.owner_broker_id = auth.uid() or is_admin())
    )
  ) with check (
    is_active_user() and exists (
      select 1 from loans l
      where l.id = loan_commissions.loan_id
        and (l.owner_broker_id = auth.uid() or is_admin())
    )
  );

-- ---- audit_log ----
-- Write-only from the client's perspective (writes go through the
-- service-role key from server actions, never directly from the browser);
-- only admins can read it back, and nobody can update or delete a row —
-- there is intentionally no update/delete policy at all.
create policy "audit_log_admin_read" on audit_log
  for select using (is_admin());

-- ---- graph_connections ----
-- Encrypted tokens; only admins can view connection metadata or manage
-- the sync. Regular staff never see this table.
create policy "graph_connections_admin_only" on graph_connections
  for all using (is_admin()) with check (is_admin());
