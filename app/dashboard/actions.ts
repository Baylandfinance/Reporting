"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/audit/log";

export async function signOutAction() {
  const profile = await getSessionProfile();
  const supabase = await createClient();
  await supabase.auth.signOut();

  if (profile) {
    await logAuditEvent({
      actorId: profile.id,
      action: "sign_out",
      resourceType: "session",
    });
  }

  redirect("/login");
}
