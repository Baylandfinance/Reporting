"use client";

import { useState, useTransition } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { adminResetPassword, deleteUser, setUserActive, updateUserRole } from "./actions";
import type { UserRole } from "@/lib/types/database";
import { Spinner } from "@/components/ui/Spinner";

export function RoleSelect({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: UserRole;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        defaultValue={currentRole}
        disabled={isPending}
        onChange={(e) =>
          startTransition(() => {
            updateUserRole(userId, e.target.value as UserRole);
          })
        }
        className="rounded-lg border border-grid bg-surface px-2 py-1 text-sm disabled:opacity-60 dark:border-grid-dark dark:bg-surface-dark"
      >
        <option value="admin">Admin</option>
        <option value="broker">Broker</option>
        <option value="assistant">Assistant</option>
      </select>
      {isPending && <Spinner className="h-3.5 w-3.5 text-ink-muted" />}
    </div>
  );
}

export function ActiveToggle({
  userId,
  isActive,
}: {
  userId: string;
  isActive: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          setUserActive(userId, !isActive);
        })
      }
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium disabled:opacity-60 ${
        isActive
          ? "bg-status-good/10 text-status-good"
          : "bg-status-critical/10 text-status-critical"
      }`}
    >
      {isPending && <Spinner className="h-3 w-3" />}
      {isPending ? "Updating…" : isActive ? "Active" : "Deactivated"}
    </button>
  );
}

export function ResetPasswordButton({
  userId,
  fullName,
  isSelf,
}: {
  userId: string;
  fullName: string;
  isSelf: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (isSelf) return null;

  function handleClick() {
    setError(null);
    const confirmed = window.confirm(
      `Set a new temporary password for ${fullName}? This also clears their MFA enrollment — they'll go through it again on next login. Only do this if they're actually locked out.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await adminResetPassword(userId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setTempPassword(result.tempPassword);
      setCopied(false);
    });
  }

  async function handleCopy() {
    if (!tempPassword) return;
    try {
      await navigator.clipboard.writeText(tempPassword);
      setCopied(true);
    } catch {
      // Clipboard access can fail (e.g. insecure context) — the password
      // still displays, so the admin can select and copy it manually.
    }
  }

  if (tempPassword) {
    return (
      <div className="flex flex-col items-end gap-1 rounded-lg border border-grid bg-surface p-2 text-right dark:border-grid-dark dark:bg-surface-dark">
        <p className="text-xs text-ink-muted">New password for {fullName} — copy it now:</p>
        <div className="flex items-center gap-2">
          <code className="rounded bg-plane px-2 py-1 text-xs text-ink dark:bg-plane-dark dark:text-ink-dark">
            {tempPassword}
          </code>
          <button
            onClick={handleCopy}
            className="rounded-lg bg-series-1 px-2 py-1 text-xs font-medium text-white hover:opacity-90"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <button
          onClick={() => setTempPassword(null)}
          className="text-xs text-ink-muted hover:underline"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        title="Set a new temporary password"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-series-1/10 hover:text-series-1 disabled:opacity-60"
      >
        {isPending ? <Spinner className="h-3.5 w-3.5" /> : <KeyRound className="h-3.5 w-3.5" />}
        {isPending ? "Resetting…" : "Reset password"}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-status-critical">{error}</p>}
    </div>
  );
}

export function DeleteUserButton({
  userId,
  fullName,
  pending,
}: {
  userId: string;
  fullName: string;
  pending: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    const confirmed = window.confirm(
      pending
        ? `Delete the pending invite for ${fullName}? You can invite the same email again straight after.`
        : `Delete ${fullName}? They've logged in before — if they have any activity on record this will be blocked automatically, but if it succeeds it's permanent.`
    );
    if (!confirmed) return;

    startTransition(async () => {
      const result = await deleteUser(userId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        title="Delete user"
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-muted transition hover:bg-status-critical/10 hover:text-status-critical disabled:opacity-60"
      >
        {isPending ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
        {isPending ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="max-w-[220px] text-right text-xs text-status-critical">{error}</p>}
    </div>
  );
}
