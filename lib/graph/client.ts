// Minimal Microsoft Graph delegated-auth client for the Excel Online sync.
// Deliberately dependency-free (no @azure/msal-node) — the app only ever
// needs three calls: authorize URL, code-for-token exchange, and
// refresh-for-access-token — so a full MSAL client would be more surface
// area than the feature needs.

const AUTHORITY = (tenantId: string) => `https://login.microsoftonline.com/${tenantId}`;

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

/**
 * Reads the "used range" of one worksheet in an Excel Online workbook via
 * Microsoft Graph. Expects row 1 to be headers matching the columns
 * documented in docs/SETUP.md's "Excel Online sheet format" section.
 */
export async function fetchWorksheetValues({
  accessToken,
  driveItemId,
  worksheetName,
}: {
  accessToken: string;
  driveItemId: string;
  worksheetName: string;
}): Promise<string[][]> {
  const url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(
    driveItemId
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
