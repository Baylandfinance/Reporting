import { requireRole } from "@/lib/auth/rbac";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/nav/Topbar";
import { Card } from "@/components/charts/Card";
import { RoleSelect, ActiveToggle, DeleteUserButton } from "./controls";
import { InviteUserForm } from "./InviteUserForm";

export default async function UsersPage() {
  const admin = await requireRole("admin");
  const supabase = await createClient();
  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  // last_sign_in_at only exists on auth.users, not profiles — needed to tell
  // a still-pending invite (safe to delete) from staff who've actually used
  // the platform (deleting them would hit the DB's own foreign-key guard
  // against destroying audit history, so this is purely a UI hint).
  const serviceClient = createServiceRoleClient();
  const { data: authUsers } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
  const lastSignInById = new Map(
    (authUsers?.users ?? []).map((u) => [u.id, u.last_sign_in_at])
  );

  return (
    <>
      <Topbar
        title="Users & Access"
        subtitle="Manage staff roles. Deactivating a user immediately revokes their session."
      />
      <main className="flex-1 space-y-6 p-6">
        <Card
          title="Invite a new user"
          subtitle="They'll get an email to set their own password, then be walked through MFA enrollment."
        >
          <InviteUserForm />
        </Card>

        <Card title="Staff accounts">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Role</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grid dark:divide-grid-dark">
              {(profiles ?? []).map((p) => {
                const pending = !lastSignInById.get(p.id);
                return (
                  <tr key={p.id}>
                    <td className="py-3 font-medium text-ink dark:text-ink-dark">
                      {p.full_name}
                    </td>
                    <td className="py-3">
                      <RoleSelect userId={p.id} currentRole={p.role} />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <ActiveToggle userId={p.id} isActive={p.is_active} />
                        {pending && (
                          <span className="rounded-full bg-ink-muted/10 px-3 py-1 text-xs font-medium text-ink-muted">
                            Pending invite
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 text-right">
                      {p.id !== admin.id && pending && (
                        <DeleteUserButton userId={p.id} fullName={p.full_name} />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="mt-4 text-xs text-ink-muted">
          Every role change, deactivation, and deletion is written to the
          audit log. New sign-ups default to the lowest-privilege
          &quot;assistant&quot; role and must be promoted here — nobody
          grants themselves broker or admin access by signing up. A user can
          only be deleted while their invite is still pending (no login
          activity yet) — once someone has actually used the platform,
          deleting them is blocked to protect the audit trail; deactivate
          them instead. To resend an expired invite, delete the pending
          entry and invite the same email again above.
        </p>
      </main>
    </>
  );
}
