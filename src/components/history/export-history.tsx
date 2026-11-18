"use client";

import { useState } from "react";
import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useTransient } from "@/hooks/use-transient";
import { exportHistory } from "@/lib/actions/history-export";
import { deliverFile, type Delivery } from "@/lib/file-delivery";
import { haptic } from "@/lib/utils";

/**
 * The two export buttons — whole history on `/settings`, one exercise inside
 * the sheet on `/exercises/[id]`. Neutral throughout: a file is not state that
 * matters on the training screen, so none of it spends volt.
 */
export function HistoryExportButtons({
  exerciseId,
}: {
  /** Absent: everything you have logged. */
  exerciseId?: string;
}) {
  const [busy, setBusy] = useState<"csv" | "json" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, flashDone] = useTransient<Delivery | null>(null, 2500);

  async function run(format: "csv" | "json") {
    if (busy) return;
    setBusy(format);
    setError(null);
    haptic.light();
    try {
      const res = await exportHistory({ format, exerciseId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const file = res.data!;
      flashDone(await deliverFile(file.filename, file.body, file.mime));
    } catch {
      setError("Couldn't export. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="solid"
          loading={busy === "csv"}
          disabled={busy != null}
          onClick={() => run("csv")}
        >
          <FileSpreadsheet className="size-4" />
          CSV
        </Button>
        <Button
          variant="solid"
          loading={busy === "json"}
          disabled={busy != null}
          onClick={() => run("json")}
        >
          <FileJson className="size-4" />
          JSON
        </Button>
      </div>
      <p className="text-text-3 text-[13px] leading-relaxed" aria-live="polite">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : done === "copied" ? (
          "Copied to the clipboard as text."
        ) : done ? (
          "File ready."
        ) : (
          "CSV opens in any spreadsheet, one row per set. JSON keeps the full structure, plus your records. Weights are in kg, with a pounds column if you train in lb."
        )}
      </p>
    </div>
  );
}

/** NavBar icon on an exercise page, opening the per-exercise export. */
export function ExportExerciseButton({
  exerciseId,
  name,
}: {
  exerciseId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton label="Export history" onClick={() => setOpen(true)}>
        <Download className="size-5" />
      </IconButton>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={`Export ${name}`}
        dismissLabel="Done"
      >
        <div className="px-4 pb-5 text-left">
          <HistoryExportButtons exerciseId={exerciseId} />
        </div>
      </Sheet>
    </>
  );
}
