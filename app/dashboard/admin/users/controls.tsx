"use client";

import { useTransition } from "react";
import { setUserActive, updateUserRole } from "./actions";
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
