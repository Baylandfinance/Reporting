import { requireSessionProfile } from "@/lib/auth/session";
import { Topbar } from "@/components/nav/Topbar";
import { Card } from "@/components/charts/Card";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { EditNameForm } from "@/components/account/EditNameForm";

export default async function AccountPage() {
  const profile = await requireSessionProfile();

  return (
    <>
      <Topbar title="My account" subtitle="Manage your own login details." />
      <main className="flex-1 space-y-6 p-6">
        <Card title="Profile">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-muted">Name</dt>
              <dd>
                <EditNameForm initialName={profile.full_name} />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Email</dt>
              <dd className="text-sm text-ink dark:text-ink-dark">{profile.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Role</dt>
              <dd className="text-sm capitalize text-ink dark:text-ink-dark">{profile.role}</dd>
            </div>
          </dl>
        </Card>

        <Card title="Change password" subtitle="You'll need your current password to confirm it's you.">
          <ChangePasswordForm />
        </Card>
      </main>
    </>
  );
}
