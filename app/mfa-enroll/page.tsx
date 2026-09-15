"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Every account on this platform must enroll a TOTP factor before it can
 * reach /dashboard — enforced server-side in lib/supabase/middleware.ts,
 * not just by this page being the only route that links onward. This page
 * is reachable exactly because the middleware redirected here.
 */
export default function MfaEnrollPage() {
  const router = useRouter();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.mfa
      .enroll({ factorType: "totp" })
      .then(({ data, error: enrollError }) => {
        if (enrollError) {
          setError(enrollError.message);
          return;
        }
        setQrCode(data.totp.qr_code);
        setFactorId(data.id);
      });
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();

    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeError || !challenge) {
      setError("Could not start verification. Refresh and try again.");
      setLoading(false);
      return;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: otp,
    });

    setLoading(false);
    if (verifyError) {
      setError("Incorrect code. Try again.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-plane px-4 dark:bg-plane-dark">
      <div className="w-full max-w-sm rounded-xl border border-grid bg-surface p-8 shadow-sm dark:border-grid-dark dark:bg-surface-dark">
        <h1 className="mb-1 text-lg font-semibold text-ink dark:text-ink-dark">
          Set up two-factor authentication
        </h1>
        <p className="mb-6 text-sm text-ink-secondary dark:text-ink-secondary-dark">
          Required before you can access any client data. Scan this with
          Google Authenticator, Microsoft Authenticator, or 1Password.
        </p>

        {qrCode ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={qrCode} alt="Scan with your authenticator app" className="mx-auto mb-6 h-44 w-44" />
        ) : (
          <p className="mb-6 text-sm text-ink-muted">Generating QR code…</p>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            placeholder="Enter 6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-lg border border-grid bg-surface px-3 py-2 text-center text-lg tracking-[0.5em] outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
          />
          {error && <p className="text-xs text-status-critical">{error}</p>}
          <button
            type="submit"
            disabled={loading || otp.length !== 6 || !factorId}
            className="w-full rounded-lg bg-series-1 px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Verifying…" : "Confirm and continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
