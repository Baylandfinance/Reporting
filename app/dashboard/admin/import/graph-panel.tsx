"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Link2, RefreshCw } from "lucide-react";
import {
  connectWorkbookLink,
  getGraphConnectionStatus,
  isMicrosoftAccountConnected,
  triggerGraphSync,
  type GraphConnectionStatus,
} from "./graph-actions";
import { ImportResultSummary } from "@/components/import/ImportResultSummary";
import type { SyncResult } from "@/lib/import/syncRows";
import { Spinner } from "@/components/ui/Spinner";

export function GraphPanel({
  initialAccountConnected,
  initialStatus,
}: {
  initialAccountConnected: boolean;
  initialStatus: GraphConnectionStatus;
}) {
  const [accountConnected, setAccountConnected] = useState(initialAccountConnected);
  const [status, setStatus] = useState<GraphConnectionStatus>(initialStatus);
  const [shareUrl, setShareUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refresh() {
    const [connected, s] = await Promise.all([
      isMicrosoftAccountConnected(),
      getGraphConnectionStatus(),
    ]);
    setAccountConnected(connected);
    setStatus(s);
  }

  function handleConnectLink(e: React.FormEvent) {
    e.preventDefault();
    setLinkError(null);
    startTransition(async () => {
      const res = await connectWorkbookLink(shareUrl);
      if (res.error) {
        setLinkError(res.error);
        return;
      }
      setShareUrl("");
      await refresh();
    });
  }

  function handleSyncNow() {
    setSyncResult(null);
    startTransition(async () => {
      const res = await triggerGraphSync();
      setSyncResult(res);
      await refresh();
    });
  }

  if (!accountConnected) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark">
          Connect a Microsoft 365 account so this can read your Excel Online workbook
          automatically, twice a day. This requires your Microsoft 365 admin to have already
          approved this app (see <code>docs/SETUP.md</code>) — if that hasn&apos;t happened yet,
          use the upload button above instead for now.
        </p>
        <a
          href="/api/graph/connect"
          className="inline-flex items-center gap-2 rounded-lg bg-series-1 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Link2 className="h-4 w-4" />
          Connect Microsoft 365 account
        </a>
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <form onSubmit={handleConnectLink} className="space-y-3">
        <p className="text-sm text-ink-secondary dark:text-ink-secondary-dark">
          Microsoft 365 account connected. Now paste the sharing link to your loan tracker
          workbook (in Excel Online: <strong>Share → Copy link</strong>).
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="url"
            required
            placeholder="https://baylandfinance.sharepoint.com/..."
            value={shareUrl}
            onChange={(e) => setShareUrl(e.target.value)}
            className="flex-1 rounded-lg border border-grid bg-surface px-3 py-2 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
          />
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-series-1 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending && <Spinner />}
            {isPending ? "Connecting…" : "Save"}
          </button>
        </div>
        {linkError && <p className="text-xs text-status-critical">{linkError}</p>}
      </form>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-status-good" />
        <span className="text-ink dark:text-ink-dark">
          Connected to <strong>{status.fileName}</strong>
        </span>
      </div>
      <p className="text-xs text-ink-muted">
        {status.lastSyncedAt
          ? `Last synced ${new Date(status.lastSyncedAt).toLocaleString("en-AU")}`
          : "Not synced yet"}
        {" · runs automatically twice a day"}
      </p>
      <button
        onClick={handleSyncNow}
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-lg border border-grid px-4 py-2 text-sm font-medium text-ink transition hover:bg-plane disabled:opacity-50 dark:border-grid-dark dark:text-ink-dark dark:hover:bg-white/5"
      >
        <RefreshCw className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Syncing…" : "Sync now"}
      </button>

      {syncResult && <ImportResultSummary result={syncResult} />}
    </div>
  );
}
