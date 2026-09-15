import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/types/database";

/**
 * Server-side Supabase client bound to the current request's auth cookies.
 * Uses the anon key — RLS policies (not this client) are what actually
 * restrict access. Never use the service-role client for user-facing reads.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no response to write to —
            // safe to ignore because middleware refreshes the session.
          }
        },
      },
    }
  );
}

/**
 * Service-role client for trusted server-only operations (e.g. the Graph
 * sync job writing rows on behalf of the whole org). This bypasses RLS —
 * it must never be imported into a client component or route that echoes
 * arbitrary user input back into a query.
 */
export function createServiceRoleClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: service-role client never manages a browser session
        },
      },
    }
  );
}
