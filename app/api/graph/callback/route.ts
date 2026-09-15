import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { requireRole } from "@/lib/auth/rbac";
import { exchangeCodeForTokens } from "@/lib/graph/client";
import { encryptToken } from "@/lib/graph/crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log";

export async function GET(request: NextRequest) {
  const admin = await requireRole("admin");

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("graph_oauth_state")?.value;
  cookieStore.delete("graph_oauth_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.json({ error: "Invalid or expired OAuth state." }, { status: 400 });
  }

  const tenantId = process.env.MS_GRAPH_TENANT_ID!;
  const clientId = process.env.MS_GRAPH_CLIENT_ID!;
  const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET!;
  const redirectUri = process.env.MS_GRAPH_REDIRECT_URI!;

  const tokens = await exchangeCodeForTokens({
    tenantId,
    clientId,
    clientSecret,
    redirectUri,
    code,
  });

  if (!tokens.refresh_token) {
    return NextResponse.json(
      { error: "Microsoft did not return a refresh token — check the offline_access scope is consented." },
      { status: 500 }
    );
  }

  const { encrypted, iv, authTag } = encryptToken(tokens.refresh_token);

  const supabase = createServiceRoleClient();
  // No workbook chosen yet — the admin pastes a sharing link on the Import
  // Data page next, which resolves to a drive/item id via Microsoft's
  // Shares API (lib/graph/client.ts's resolveShareLink).
  const { error } = await supabase.from("graph_connections").insert({
    connected_by: admin.id,
    tenant_id: tenantId,
    encrypted_refresh_token: encrypted,
    token_iv: iv,
    token_auth_tag: authTag,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAuditEvent({
    actorId: admin.id,
    action: "connect_graph_account",
    resourceType: "graph_connections",
  });

  return NextResponse.redirect(new URL("/dashboard/admin/import", request.url));
}
