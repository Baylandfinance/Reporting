import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/rbac";
import { buildAuthorizeUrl } from "@/lib/graph/client";

// Kicks off the Microsoft 365 admin consent flow. Admin-only: this grants
// the app delegated read access to whatever the signing admin's account can
// see in OneDrive/SharePoint, so it must not be something a broker or
// assistant account can trigger.
export async function GET() {
  await requireRole("admin");

  const tenantId = process.env.MS_GRAPH_TENANT_ID;
  const clientId = process.env.MS_GRAPH_CLIENT_ID;
  const redirectUri = process.env.MS_GRAPH_REDIRECT_URI;

  if (!tenantId || !clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Microsoft Graph is not configured. See docs/SETUP.md." },
      { status: 500 }
    );
  }

  const state = randomBytes(16).toString("hex");
  (await cookies()).set("graph_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const authorizeUrl = buildAuthorizeUrl({ tenantId, clientId, redirectUri, state });
  return NextResponse.redirect(authorizeUrl);
}
