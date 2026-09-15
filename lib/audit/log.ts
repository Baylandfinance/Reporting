import { headers } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";

/**
 * Records an entry in the append-only audit_log table. Called from server
 * actions and route handlers — never from client components, since it
 * writes via the service-role client to bypass the (intentionally
 * read-only-to-admins) RLS policy on this table.
 *
 * Every read or write of client/loan data, and every auth event, should go
 * through this — it is the evidence trail for both the Privacy Act
 * (accountability principle, APP 1) and NCCP record-keeping obligations,
 * and for reconstructing what happened after a suspected breach.
 */
export async function logAuditEvent({
  actorId,
  action,
  resourceType,
  resourceId,
  metadata = {},
}: {
  actorId: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  const ipAddress = forwardedFor ? forwardedFor.split(",")[0]?.trim() : null;

  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("audit_log").insert({
    actor_id: actorId,
    action,
    resource_type: resourceType,
    resource_id: resourceId ?? null,
    metadata,
    ip_address: ipAddress,
  });

  if (error) {
    // Never let an audit-log failure silently swallow the fact that it
    // failed — surface it in server logs so a broken audit trail gets
    // noticed, without blocking the user-facing action that triggered it.
    console.error("audit_log insert failed", { action, resourceType, error });
  }
}
