"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { uploadSpreadsheet } from "./actions";
import { ImportResultSummary } from "@/components/import/ImportResultSummary";
import type { SyncResult } from "@/lib/import/syncRows";
import { Spinner } from "@/components/ui/Spinner";

// Matches serverActions.bodySizeLimit in next.config.mjs.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export function UploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setResult(null);

    const file = formData.get("file");
    if (file instanceof File && file.size > MAX_UPLOAD_BYTES) {
      setResult({
        synced: 0,
        errors: [
          `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the upload limit is 4 MB. ` +
            "Delete unused tabs, images or blank formatted rows from the workbook, save it, and try again.",
        ],
        unattributedByBroker: [],
      });
      return;
    }

    startTransition(async () => {
      try {
        const res = await uploadSpreadsheet(formData);
        setResult(res);
        formRef.current?.reset();
        setFileName(null);
      } catch {
        // A thrown Server Action error (e.g. the request was rejected before
        // reaching our code) would otherwise take down the whole page.
        setResult({
          synced: 0,
          errors: ["The upload failed before the file could be processed. Reload the page and try again."],
          unattributedByBroker: [],
        });
      }
    });
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-lg border border-dashed border-grid px-4 py-3 text-sm text-ink-secondary hover:border-series-1 dark:border-grid-dark dark:text-ink-secondary-dark">
          <UploadCloud className="h-4 w-4 shrink-0" />
          <span className="truncate">{fileName ?? "Choose a .xlsx file…"}</span>
          <input
            type="file"
            name="file"
            accept=".xlsx"
            required
            className="hidden"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
        </label>
        <button
          type="submit"
          disabled={isPending || !fileName}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-series-1 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending && <Spinner />}
          {isPending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {isPending && (
        <p className="text-xs text-ink-muted">
          Reading the spreadsheet and matching rows — this can take a little while for a large file, don&apos;t close this tab.
        </p>
      )}

      {result && <ImportResultSummary result={result} />}
    </div>
  );
}
