"use server";

import { revalidatePath } from "next/cache";
import { requireSessionProfile } from "@/lib/auth/session";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log";

/**
 * Any signed-in user may rename themselves — this is not admin-gated like
 * role/active changes. Still goes through the service-role client because
 * RLS's profiles_admin_write policy only allows admins to update profile
 * rows; this action is the one place a non-admin's own name can change.
 */
export async function updateOwnName(
  fullName: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireSessionProfile();

  const trimmed = fullName.trim();
  if (!trimmed) return { ok: false, error: "Name can't be empty." };
  if (trimmed.length > 200) return { ok: false, error: "Name is too long." };

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: trimmed })
    .eq("id", profile.id);

  if (error) return { ok: false, error: error.message };

  await logAuditEvent({
    actorId: profile.id,
    action: "update_own_name",
    resourceType: "profile",
    resourceId: profile.id,
    metadata: { new_name: trimmed },
  });

  revalidatePath("/dashboard/account");
  return { ok: true };
}
