"use client";

import { useTransition } from "react";
import { setUserActive, updateUserRole } from "./actions";
import type { UserRole } from "@/lib/types/database";

export function RoleSelect({
  userId,
  currentRole,
}: {
  userId: string;
  currentRole: UserRole;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <select
      defaultValue={currentRole}
      disabled={isPending}
      onChange={(e) =>
        startTransition(() => {
          updateUserRole(userId, e.target.value as UserRole);
        })
      }
      className="rounded-lg border border-grid bg-surface px-2 py-1 text-sm dark:border-grid-dark dark:bg-surface-dark"
    >
      <option value="admin">Admin</option>
      <option value="broker">Broker</option>
      <option value="assistant">Assistant</option>
    </select>
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
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        isActive
          ? "bg-status-good/10 text-status-good"
          : "bg-status-critical/10 text-status-critical"
      }`}
    >
      {isActive ? "Active" : "Deactivated"}
    </button>
  );
}
