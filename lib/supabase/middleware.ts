import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Refreshes the Supabase auth session on every request and enforces that
 * every /dashboard route requires a signed-in session with MFA satisfied
 * (aal2). Unauthenticated or aal1-only requests are redirected rather than
 * left to individual pages to check — a missing per-page check must never
 * be the only thing standing between a request and client data.
 *
 * Supabase's own session handling has no absolute cutoff by default: as
 * long as the browser holds a valid refresh token, the SDK silently
 * refreshes the access token forever, so a session opened days ago stays
 * logged in with no further password or MFA prompt. This enforces a hard
 * 24-hour lifetime measured from the last real login (user.last_sign_in_at,
 * which only changes on an actual sign-in, not on token refresh or MFA
 * verification) — past that, the session is revoked server-side and the
 * user is sent back through password + MFA from scratch.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  const isMfaEnrollRoute = request.nextUrl.pathname.startsWith("/mfa-enroll");
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  if (user && !isLoginRoute && user.last_sign_in_at) {
    const sessionAgeMs = Date.now() - new Date(user.last_sign_in_at).getTime();
    if (sessionAgeMs > MAX_SESSION_AGE_MS) {
      // Revoke this session's refresh token server-side, not just the
      // cookie in this browser — 'local' scope so other devices this user
      // is signed in on aren't affected by this one session's cutoff.
      await supabase.auth.signOut({ scope: "local" });

      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("expired", "1");
      if (isDashboardRoute || isMfaEnrollRoute) {
        url.searchParams.set("next", request.nextUrl.pathname);
      }
      return NextResponse.redirect(url);
    }
  }

  if (isDashboardRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if ((isDashboardRoute || isMfaEnrollRoute) && user) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal && aal.currentLevel !== "aal2") {
      if (aal.nextLevel === "aal2") {
        // Enrolled but hasn't completed the second factor this session.
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", request.nextUrl.pathname);
        url.searchParams.set("mfa", "required");
        return NextResponse.redirect(url);
      }
      if (isDashboardRoute) {
        // No factor enrolled yet — force enrollment before any client data
        // is reachable. Every login for this platform must end in aal2.
        const url = request.nextUrl.clone();
        url.pathname = "/mfa-enroll";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
