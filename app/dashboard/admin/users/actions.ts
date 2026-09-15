"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/rbac";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAuditEvent } from "@/lib/audit/log";
import type { UserRole } from "@/lib/types/database";

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
