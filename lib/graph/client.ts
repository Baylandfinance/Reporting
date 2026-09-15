// Minimal Microsoft Graph delegated-auth client for the Excel Online sync.
// Deliberately dependency-free (no @azure/msal-node) — the app only ever
// needs a handful of calls (authorize URL, token exchange/refresh, resolve
// a sharing link, list worksheets, read a worksheet's values) — so a full
// MSAL client would be more surface area than the feature needs.

import type { SourceRow } from "@/lib/import/normalize";

const AUTHORITY = (tenantId: string) => `https://login.microsoftonline.com/${tenantId}`;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

// Read-only, single-purpose scope. Do not widen this without a reason —
// every extra scope is more of the firm's 365 tenant this app can touch.
const SCOPES = ["offline_access", "Files.Read.All"].join(" ");

export function buildAuthorizeUrl({
  tenantId,
  clientId,
  redirectUri,
  state,
}: {
  tenantId: string;
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(`${AUTHORITY(tenantId)}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeCodeForTokens({
  tenantId,
  clientId,
  clientSecret,
  redirectUri,
  code,
}: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<TokenResponse> {
  const res = await fetch(`${AUTHORITY(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    throw new Error(`Graph token exchange failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function refreshAccessToken({
  tenantId,
  clientId,
  clientSecret,
  refreshToken,
}: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<TokenResponse> {
  const res = await fetch(`${AUTHORITY(tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: SCOPES,
    }),
  });

  if (!res.ok) {
    throw new Error(`Graph token refresh failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

// Microsoft's "encoded sharing URL" scheme — turns an ordinary SharePoint/
// OneDrive share link into the opaque id the /shares endpoint expects, so
// an admin can paste the link they already have instead of hunting for a
// drive/item id through Graph Explorer.
// https://learn.microsoft.com/graph/api/shares-get
function encodeSharingUrl(shareUrl: string): string {
  const base64 = Buffer.from(shareUrl, "utf8").toString("base64");
  const urlSafe = base64.replaceAll("=", "").replaceAll("/", "_").replaceAll("+", "-");
  return `u!${urlSafe}`;
}

export type ResolvedDriveItem = { driveId: string; itemId: string; name: string };

/** Resolves a SharePoint/OneDrive sharing link (e.g. pasted from "Copy link") to a driveId + itemId. */
export async function resolveShareLink(
  shareUrl: string,
  accessToken: string
): Promise<ResolvedDriveItem> {
  const shareId = encodeSharingUrl(shareUrl);
  const res = await fetch(`${GRAPH_BASE}/shares/${shareId}/driveItem`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(
      `Could not resolve that link via Microsoft Graph: ${res.status} ${await res.text()}`
    );
  }

  const item = await res.json();
  const driveId = item?.parentReference?.driveId;
  const itemId = item?.id;
  if (!driveId || !itemId) {
    throw new Error("Microsoft Graph didn't return a drive/item id for that link.");
  }
  return { driveId, itemId, name: item.name ?? "workbook.xlsx" };
}

/** Lists worksheet (tab) names in a workbook, so the sync can default to the first one sensibly. */
export async function listWorksheetNames(
  accessToken: string,
  driveId: string,
  itemId: string
): Promise<string[]> {
  const url = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(
    itemId
  )}/workbook/worksheets`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new Error(`Could not list worksheets: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return (body.value ?? []).map((w: { name: string }) => w.name);
}

/**
 * Reads the "used range" of one worksheet in an Excel Online workbook via
 * Microsoft Graph. Expects row 1 to be headers matching the columns
 * documented in docs/SETUP.md's "Excel Online sheet format" section.
 */
export async function fetchWorksheetValues({
  accessToken,
  driveId,
  itemId,
  worksheetName,
}: {
  accessToken: string;
  driveId: string;
  itemId: string;
  worksheetName: string;
}): Promise<SourceRow[]> {
  const url = `${GRAPH_BASE}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(
    itemId
  )}/workbook/worksheets/${encodeURIComponent(worksheetName)}/usedRange(valuesOnly=true)`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Graph worksheet read failed: ${res.status} ${await res.text()}`);
  }

  const body = await res.json();
  return body.values ?? [];
}
