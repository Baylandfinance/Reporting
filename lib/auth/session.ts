import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Returns the signed-in user's profile (role included) or null. This is the
 * single source of truth pages should use to decide what to render — never
 * trust a role passed in from the client.
 *
 * Wrapped in React's cache() because both the dashboard layout (for the
 * sidebar name/role) and the page it's rendering (for the actual report)
 * call this independently — without memoizing, that was two full
 * auth.getUser() + profiles round trips to Supabase on every single page
 * view, on top of the one middleware already does. cache() dedupes calls
 * with the same arguments (none, here) within one request/render pass.
 */
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
});

/** Throws if there's no session — use in server actions/route handlers that must be authenticated. */
export async function requireSessionProfile(): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) {
    throw new Error("Not authenticated");
  }
  return profile;
}
