import type { UserRole } from "@/lib/types/database";
import { requireSessionProfile } from "@/lib/auth/session";

/**
 * Server-side guard for admin-only actions/pages. RLS is the real backstop,
 * but this gives a clean error before a query is even attempted, and keeps
 * admin-only UI (e.g. Users & Access) from rendering for the wrong role.
 */
export async function requireRole(...allowed: UserRole[]) {
  const profile = await requireSessionProfile();
  if (!allowed.includes(profile.role)) {
    throw new Error(`Forbidden: requires role ${allowed.join(" or ")}`);
  }
  return profile;
}
