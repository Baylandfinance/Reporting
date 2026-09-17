"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield } from "lucide-react";

type Step = "credentials" | "mfa";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const expired = params.get("expired") === "1";

  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);
    if (signInError) {
      setError("Incorrect email or password.");
      return;
    }

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      setStep("mfa");
      return;
    }

    router.push(next);
    router.refresh();
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp?.[0];
    if (!factor) {
      setError("No authenticator app is enrolled on this account.");
      setLoading(false);
      return;
    }

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: factor.id });

    if (challengeError || !challenge) {
      setError("Could not start verification. Try again.");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: otp,
    });

    setLoading(false);
    if (verifyError) {
      setError("Incorrect code. Check your authenticator app and try again.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-plane px-4 dark:bg-plane-dark">
      <div className="w-full max-w-sm rounded-xl border border-grid bg-surface p-8 shadow-sm dark:border-grid-dark dark:bg-surface-dark">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-series-1 text-sm font-bold text-white">
            BF
          </div>
          <div>
            <div className="text-sm font-semibold text-ink dark:text-ink-dark">
              Bayland Finance
            </div>
            <div className="text-xs text-ink-muted">Reporting platform</div>
          </div>
        </div>

        {expired && (
          <p className="mb-4 rounded-lg bg-series-1/10 px-3 py-2 text-xs text-series-1">
            Your session expired after 24 hours. Sign in again to continue.
          </p>
        )}

        {step === "credentials" ? (
          <form onSubmit={handleCredentials} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
                Email
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
                Password
              </label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
              />
            </div>
            {error && <p className="text-xs text-status-critical">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-series-1 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Continue"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleMfa} className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-series-1/10 px-3 py-2 text-xs text-series-1">
              <Shield className="h-3.5 w-3.5" />
              Enter the 6-digit code from your authenticator app
            </div>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-lg border border-grid bg-surface px-3 py-2 text-center text-lg tracking-[0.5em] outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
            />
            {error && <p className="text-xs text-status-critical">{error}</p>}
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full rounded-lg bg-series-1 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-[11px] text-ink-muted">
          Internal platform. Unauthorised access attempts are logged.
        </p>
      </div>
    </main>
  );
}
