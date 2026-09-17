"use client";

import { useState, useTransition } from "react";
import { inviteUser } from "./actions";
import type { UserRole } from "@/lib/types/database";
import { Spinner } from "@/components/ui/Spinner";

export function InviteUserForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("broker");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await inviteUser(fullName, email, role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess(`Invite sent to ${email}.`);
      setFullName("");
      setEmail("");
      setRole("broker");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
          Full name
        </label>
        <input
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-secondary dark:text-ink-secondary-dark">
          Role
        </label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as UserRole)}
          className="rounded-lg border border-grid bg-surface px-2 py-2 text-sm dark:border-grid-dark dark:bg-surface-dark"
        >
          <option value="admin">Admin</option>
          <option value="broker">Broker</option>
          <option value="assistant">Assistant</option>
        </select>
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending && <Spinner />}
        {isPending ? "Sending…" : "Send invite"}
      </button>
      {error && <p className="w-full text-xs text-status-critical">{error}</p>}
      {success && <p className="w-full text-xs text-status-good">{success}</p>}
    </form>
  );
}
