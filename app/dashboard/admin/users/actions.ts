"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/rbac";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log";
import type { UserRole } from "@/lib/types/database";

const VALID_ROLES: UserRole[] = ["admin", "broker", "assistant"];

/**
 * Returns a result object instead of throwing. Next.js's Server Action
 * error channel is meant for genuinely exceptional failures, and in
 * production it can mangle a thrown Error's message on the way back to the
 * client (surfacing React's own generic minified-error text instead of the
 * message we set). Expected, user-facing outcomes — duplicate email, rate
 * limit, bad input — should never go through that path.
 */
export async function inviteUser(
  fullName: string,
  email: string,
  role: UserRole
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = await requireRole("admin");

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName) return { ok: false, error: "Name is required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!VALID_ROLES.includes(role)) return { ok: false, error: "Invalid role." };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return { ok: false, error: "NEXT_PUBLIC_APP_URL is not configured." };

  const supabase = createServiceRoleClient();

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(trimmedEmail, {
    redirectTo: `${appUrl}/auth/set-password`,
    data: { full_name: trimmedName },
  });

  if (error) {
    // Supabase's shared email sender has a very low rate limit — surface
    // that distinctly so the admin doesn't mistake it for a real failure.
    if (error.message.toLowerCase().includes("rate limit")) {
      return {
        ok: false,
        error:
          "Email rate limit exceeded. Wait an hour and try again, or set up custom SMTP for reliable sending.",
      };
    }
    return { ok: false, error: error.message };
  }

  const newUserId = data.user?.id;
  if (newUserId && role !== "assistant") {
    // New accounts default to 'assistant' via the on_auth_user_created
    // trigger — set the chosen role immediately rather than waiting for
    // the admin to do a second step in the table below.
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", newUserId);
    if (roleError) return { ok: false, error: roleError.message };
  }

  await logAuditEvent({
    actorId: admin.id,
    action: "invite_user",
    resourceType: "profile",
    resourceId: newUserId ?? null,
    metadata: { email: trimmedEmail, role },
  });

  revalidatePath("/dashboard/admin/users");
  return { ok: true };
}

export async function updateUserRole(userId: string, role: UserRole) {
  const admin = await requireRole("admin");
  const supabase = createServiceRoleClient();

  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);

  await logAuditEvent({
    actorId: admin.id,
    action: "update_user_role",
    resourceType: "profile",
    resourceId: userId,
    metadata: { new_role: role },
  });

  revalidatePath("/dashboard/admin/users");
}

export async function setUserActive(userId: string, isActive: boolean) {
  const admin = await requireRole("admin");
  if (userId === admin.id && !isActive) {
    throw new Error("You cannot deactivate your own account.");
  }
  const supabase = createServiceRoleClient();

  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);
  if (error) throw new Error(error.message);

  // Flipping is_active alone only affects RLS on future queries — an
  // already-issued session token would still pass auth.getUser() until it
  // expires. Ban the underlying auth user too so deactivation is immediate,
  // not "eventually, once their token times out".
  const { error: banError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: isActive ? "none" : "876000h", // ~100 years: effectively permanent until reactivated
  });
  if (banError) throw new Error(banError.message);

  await logAuditEvent({
    actorId: admin.id,
    action: isActive ? "reactivate_user" : "deactivate_user",
    resourceType: "profile",
    resourceId: userId,
  });

  revalidatePath("/dashboard/admin/users");
}
