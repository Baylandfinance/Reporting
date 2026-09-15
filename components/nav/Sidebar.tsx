import Link from "next/link";
import { LayoutDashboard, GitBranch, Wallet, Landmark, Users2, Settings, UploadCloud } from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/pipeline", label: "Pipeline & Settlements", icon: GitBranch },
  { href: "/dashboard/commissions", label: "Commissions", icon: Wallet },
  { href: "/dashboard/lenders", label: "Lenders & Products", icon: Landmark },
  { href: "/dashboard/referrals", label: "Clients & Referrals", icon: Users2 },
];

export function Sidebar({
  displayName,
  role,
}: {
  displayName: string;
  role: string;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col bg-[#111113] text-[#c3c2b7] md:flex">
      <div className="flex items-center gap-2 px-6 py-6">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-series-1 text-sm font-bold text-white">
          BF
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Bayland Finance</div>
          <div className="text-[11px] uppercase tracking-wide text-ink-muted">
            Reporting
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3">
        <div className="px-3 pb-2 pt-4 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
          Reports
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#c3c2b7] transition hover:bg-white/5 hover:text-white"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}

        {role === "admin" && (
          <>
            <div className="px-3 pb-2 pt-6 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              Admin
            </div>
            <Link
              href="/dashboard/admin/import"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#c3c2b7] transition hover:bg-white/5 hover:text-white"
            >
              <UploadCloud className="h-4 w-4" />
              Import Data
            </Link>
            <Link
              href="/dashboard/admin/users"
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#c3c2b7] transition hover:bg-white/5 hover:text-white"
            >
              <Settings className="h-4 w-4" />
              Users & Access
            </Link>
          </>
        )}
      </nav>

      <div className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-series-1/20 text-xs font-semibold text-white">
          {displayName
            .split(" ")
            .map((n) => n[0])
            .slice(0, 2)
            .join("")}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-white">{displayName}</div>
          <div className="truncate text-xs capitalize text-ink-muted">{role}</div>
        </div>
      </div>
    </aside>
  );
}
