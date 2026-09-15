import { requireRole } from "@/lib/auth/rbac";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/nav/Topbar";
import { Card } from "@/components/charts/Card";
import { RoleSelect, ActiveToggle } from "./controls";

export default async function UsersPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <>
      <Topbar
        title="Users & Access"
        subtitle="Manage staff roles. Deactivating a user immediately revokes their session."
      />
      <main className="flex-1 p-6">
        <Card title="Staff accounts">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid dark:divide-grid-dark">
              {(profiles ?? []).map((p) => (
                <tr key={p.id}>
                  <td className="py-3 font-medium text-ink dark:text-ink-dark">
                    {p.full_name}
                  </td>
                  <td className="py-3">
                    <RoleSelect userId={p.id} currentRole={p.role} />
                  </td>
                  <td className="py-3">
                    <ActiveToggle userId={p.id} isActive={p.is_active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <p className="mt-4 text-xs text-ink-muted">
          Every role change and deactivation is written to the audit log.
          New sign-ups default to the lowest-privilege &quot;assistant&quot;
          role and must be promoted here — nobody grants themselves broker
          or admin access by signing up.
        </p>
      </main>
    </>
  );
}
