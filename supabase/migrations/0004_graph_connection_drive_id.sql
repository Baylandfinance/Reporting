-- Switches the Graph connection from the personal-OneDrive-only
-- /me/drive/items/{id} shape to the generic /drives/{driveId}/items/{id}
-- shape, which also works for a file living in a SharePoint site's
-- document library (the "Application Management" workbook lives in
-- SharePoint, not a personal OneDrive). drive_id is resolved automatically
-- from a pasted sharing link via Microsoft's Shares API — see
-- app/dashboard/admin/import and lib/graph/client.ts's resolveShareLink.

alter table graph_connections
  add column if not exists drive_id text,
  add column if not exists file_name text;

alter table graph_connections
  alter column drive_item_id drop not null;
