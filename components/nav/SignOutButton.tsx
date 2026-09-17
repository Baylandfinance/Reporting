"use client";

import { useFormStatus } from "react-dom";
import { LogOut } from "lucide-react";
import { Spinner } from "@/components/ui/Spinner";

/** Split out from Topbar because useFormStatus only reports its enclosing <form>'s state. */
export function SignOutButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex items-center gap-1.5 rounded-lg border border-grid px-3 py-1.5 text-sm text-ink-secondary transition hover:bg-plane disabled:opacity-60 dark:border-grid-dark dark:text-ink-secondary-dark dark:hover:bg-white/5"
    >
      {pending ? <Spinner className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
