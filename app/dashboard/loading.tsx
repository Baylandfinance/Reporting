/**
 * Next.js shows this automatically the instant a nested /dashboard/* route
 * is clicked, while that page's server component is still fetching data —
 * without it, clicking a sidebar tab left the old page sitting on screen
 * with no indication anything was happening until the new page was fully
 * ready to paint.
 */
export default function DashboardLoading() {
  return (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-grid bg-surface px-6 py-4 dark:border-grid-dark dark:bg-surface-dark">
        <div className="space-y-2">
          <div className="h-5 w-48 animate-pulse rounded bg-plane dark:bg-plane-dark" />
          <div className="h-3 w-72 animate-pulse rounded bg-plane dark:bg-plane-dark" />
        </div>
      </div>
      <main className="flex-1 space-y-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-grid bg-surface dark:border-grid-dark dark:bg-surface-dark"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl border border-grid bg-surface dark:border-grid-dark dark:bg-surface-dark" />
        <div className="h-72 animate-pulse rounded-xl border border-grid bg-surface dark:border-grid-dark dark:bg-surface-dark" />
      </main>
    </>
  );
}
