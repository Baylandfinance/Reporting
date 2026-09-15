"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ShieldCheck } from "lucide-react";

/**
 * Where an invited user lands after clicking the link in Supabase's invite
 * email. supabase-js reads the invite token out of the URL on load and
 * establishes a session automatically — this page's only job is to let
 * that new user set the password nobody else (including Sam) ever knew.
 */
export default function SetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordForm() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setInvalid(true);
      }
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Couldn't set your password. Try again.");
      return;
    }

    router.push("/dashboard");
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

        {!ready ? (
          <p className="text-sm text-ink-muted">Checking your invite link…</p>
        ) : invalid ? (
          <div className="space-y-3">
            <p className="text-sm text-ink dark:text-ink-dark">
              This invite link has expired or was already used.
            </p>
            <p className="text-xs text-ink-muted">
              Ask an admin to send you a new invite from Users &amp; Access, or
              go to{" "}
              <a href="/login" className="text-series-1 underline">
                the login page
              </a>{" "}
              if you already have a password.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-series-1/10 px-3 py-2 text-xs text-series-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Set a password only you will know
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
                New password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
                Confirm password
              </label>
              <input
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
              />
            </div>
            {error && <p className="text-xs text-status-critical">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-series-1 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {loading ? "Saving…" : "Set password and continue"}
            </button>
            <p className="text-center text-[11px] text-ink-muted">
              You&apos;ll be asked to set up an authenticator app next.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
