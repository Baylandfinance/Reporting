import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth/session";
import { Sidebar } from "@/components/nav/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex min-h-screen bg-plane dark:bg-plane-dark">
      <Sidebar displayName={profile.full_name} role={profile.role} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
