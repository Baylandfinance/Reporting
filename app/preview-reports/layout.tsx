import { notFound } from "next/navigation";
import { Sidebar } from "@/components/nav/Sidebar";

// PREVIEW ONLY — renders the proposed management report pages with the
// specs' dummy data so they can be screenshotted without a login. Sits
// outside /dashboard (no auth gate), so it is disabled in any deployed
// build and only renders under `next dev`. Delete once the real pages ship.
export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="flex min-h-screen bg-plane dark:bg-plane-dark">
      <Sidebar displayName="Sam" role="admin" />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="bg-status-warning/20 px-6 py-2 text-xs font-medium text-ink">
          Preview with dummy data from the specification. Not real figures.
        </div>
        {children}
      </div>
    </div>
  );
}
