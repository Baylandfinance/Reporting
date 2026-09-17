"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnName } from "@/app/dashboard/account/actions";
import { Spinner } from "@/components/ui/Spinner";

export function EditNameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateOwnName(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink dark:text-ink-dark">{initialName}</span>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs font-medium text-series-1 hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        required
        maxLength={200}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
        className="rounded-lg border border-grid bg-surface px-3 py-1.5 text-sm outline-none focus:border-series-1 dark:border-grid-dark dark:bg-surface-dark"
      />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-series-1 px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending && <Spinner className="h-3 w-3" />}
        {isPending ? "Saving…" : "Save"}
      </button>
      <button
        type="button"
        onClick={() => {
          setName(initialName);
          setEditing(false);
          setError(null);
        }}
        className="text-xs text-ink-muted hover:underline"
      >
        Cancel
      </button>
      {error && <p className="text-xs text-status-critical">{error}</p>}
    </form>
  );
}
