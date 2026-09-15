import { LogOut, Shield } from "lucide-react";
import { signOutAction } from "@/app/dashboard/actions";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-grid bg-surface px-6 py-4 dark:border-grid-dark dark:bg-surface-dark">
      <div>
        <h1 className="text-lg font-semibold text-ink dark:text-ink-dark">{title}</h1>
        {subtitle && (
          <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark">
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1.5 rounded-full bg-status-good/10 px-3 py-1 text-xs font-medium text-status-good sm:flex">
          <Shield className="h-3.5 w-3.5" />
          MFA active session
        </span>
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-lg border border-grid px-3 py-1.5 text-sm text-ink-secondary transition hover:bg-plane dark:border-grid-dark dark:text-ink-secondary-dark dark:hover:bg-white/5"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
