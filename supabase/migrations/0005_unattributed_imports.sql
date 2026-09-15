-- Previously, a loan whose "Broker" text didn't match a staff account's
-- full_name was skipped entirely — meaning nobody, including an admin,
-- could see it, since the row was never created. That's wrong: RLS exists
-- to stop one broker seeing another broker's clients, not to stop the
-- business owner seeing their own historical book while staff accounts
-- are still being set up.
--
-- owner_broker_id becomes nullable on both tables. A NULL owner means
-- "not yet attributed to a real staff account" — admins and assistants
-- still see it (their read policies already OR in is_admin() /
-- current_role_is('assistant') independent of the owner check), but a
-- broker's own-book policy (owner_broker_id = auth.uid()) correctly never
-- matches a NULL, so nothing changes about broker-to-broker isolation.
--
-- broker_name_raw preserves exactly what was in the sheet, so an admin can
-- later reassign these to the right real account without re-importing.

alter table clients
  alter column owner_broker_id drop not null,
  add column if not exists broker_name_raw text;

alter table loans
  alter column owner_broker_id drop not null,
  add column if not exists broker_name_raw text;
