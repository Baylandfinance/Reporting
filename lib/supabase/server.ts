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
 * Anon-key client with no cookie storage at all — every auth call it makes
 * (e.g. signInWithPassword to verify a password) is entirely in-memory and
 * never touches the real request's session. Use this for anything that
 * needs to check a credential without disturbing the caller's actual
 * signed-in session; the regular createClient() would overwrite the
 * current session's cookies with a fresh one from that call.
 */
export function createStatelessAnonClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // no-op: this client's session must never leak into real cookies
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
