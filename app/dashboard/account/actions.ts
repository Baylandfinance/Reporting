"use server";

import { revalidatePath } from "next/cache";
import { requireSessionProfile } from "@/lib/auth/session";
import { createServiceRoleClient, createStatelessAnonClient } from "@/lib/supabase/server";
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

/**
 * Verifying the current password by calling signInWithPassword from the
 * browser client (as this used to) creates a brand-new session there and
 * then overwrites the real one's cookies with it — silently dropping the
 * user from their already-MFA-verified (aal2) session down to a fresh
 * password-only (aal1) one. The subsequent password update itself may
 * still succeed, but the user is left in a broken session state that
 * looked like the update had failed. Verifying here instead, with a
 * client that never writes any cookies, leaves the real session untouched
 * no matter what the verification call does internally.
 */
export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireSessionProfile();

  if (newPassword.length < 8) {
    return { ok: false, error: "New password must be at least 8 characters." };
  }

  const verifyClient = createStatelessAnonClient();
  const { error: verifyError } = await verifyClient.auth.signInWithPassword({
    email: profile.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { ok: false, error: "Current password is incorrect." };
  }

  const supabase = createServiceRoleClient();
  const { error } = await supabase.auth.admin.updateUserById(profile.id, {
    password: newPassword,
  });
  if (error) return { ok: false, error: error.message };

  await logAuditEvent({
    actorId: profile.id,
    action: "change_own_password",
    resourceType: "profile",
    resourceId: profile.id,
  });

  return { ok: true };
}
