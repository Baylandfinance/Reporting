"use client";

import { useRef, useState, useTransition } from "react";
import { UploadCloud } from "lucide-react";
import { uploadSpreadsheet } from "./actions";
import { ImportResultSummary } from "@/components/import/ImportResultSummary";
import type { SyncResult } from "@/lib/import/syncRows";

export function UploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      const res = await uploadSpreadsheet(formData);
      setResult(res);
      formRef.current?.reset();
      setFileName(null);
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
          className="rounded-lg bg-series-1 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Uploading…" : "Upload"}
        </button>
      </form>

      {result && <ImportResultSummary result={result} />}
    </div>
  );
}
