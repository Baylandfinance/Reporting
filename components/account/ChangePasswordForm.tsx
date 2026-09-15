"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Requires the current password before allowing a change, even though the
 * user already has an active session — a stolen/left-open browser session
 * shouldn't be enough on its own to lock the real owner out of their
 * account. Verified by re-running signInWithPassword rather than calling
 * some dedicated "reauthenticate" API, since Supabase doesn't expose one
 * for password confirmation.
 */
export function ChangePasswordForm({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirm) {
      setError("New passwords don't match.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (reauthError) {
      setLoading(false);
      setError("Current password is incorrect.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);
    if (updateError) {
      setError("Couldn't update your password. Try again.");
      return;
    }

    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
          Current password
        </label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
        />
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
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
          Confirm new password
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
      {success && (
        <p className="text-xs text-status-good">Password updated.</p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
