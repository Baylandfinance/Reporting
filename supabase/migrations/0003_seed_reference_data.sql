-- Seeds pipeline_stages with a cleaned, de-duplicated version of the
-- distinct "Status" values found in the sample workbook (case variants
-- like "Hold"/"hold" and "Lost"/"lost" collapsed to one canonical row —
-- the sync normalises incoming text to match these before inserting a new
-- one, so it doesn't silently create "Hold" and "hold" as two stages).
-- Review and adjust the category assignments against how the business
-- actually treats each status before relying on the aggregate reports.

insert into pipeline_stages (name, category, sort_order) values
  ('Prospect', 'lead', 10),
  ('Lead', 'lead', 20),
  ('Referrer Set up', 'lead', 30),
  ('Follow up', 'active', 40),
  ('Warm', 'active', 50),
  ('Active', 'active', 60),
  ('Planned solution', 'active', 70),
  ('Planned submission', 'active', 80),
  ('Submitted', 'active', 90),
  ('Pre approval expired', 'on_hold', 100),
  ('Hold', 'on_hold', 110),
  ('Settled', 'settled', 120),
  ('Lost', 'lost', 130)
on conflict (name) do nothing;
