"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileJson, Link2, Upload } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import {
  exportRoutineFile,
  importRoutine,
  previewRoutineImport,
  type ImportPreview,
} from "@/lib/actions/routine-transfer";
import { haptic, labelize } from "@/lib/utils";

/**
 * Client half of routine export and import.
 *
 * The delivery path matters more than it looks. `<a download>` on a blob URL is
 * unreliable in an installed iOS PWA — a blob navigation in standalone display
 * mode either renders the JSON as text in a new context or does nothing, and it
 * can bounce the user out of the app entirely. Since this app is meant to live
 * on a home screen, the native share sheet leads and the anchor is the
 * desktop/Android fallback, with the clipboard behind both.
 */

/** Bigger than any routine this app can produce; rejected before it is read. */
const MAX_FILE_BYTES = 512 * 1024;

type Delivery = "shared" | "downloaded" | "copied";

async function deliver(filename: string, json: string): Promise<Delivery> {
  const file = new File([json], filename, { type: "application/json" });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch {
      /* Dismissed, or the sheet refused the file — fall through. */
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking synchronously races the download in some browsers.
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    return "downloaded";
  } catch {
    await navigator.clipboard.writeText(json);
    return "copied";
  }
}

export function ShareRoutineSheet({
  open,
  onClose,
  routineId,
  routineName,
  /** Whether a link would actually resolve for whoever received it. */
  linkWorks,
  onShareLink,
  linkCopied,
}: {
  open: boolean;
  onClose: () => void;
  routineId: string;
  routineName: string;
  linkWorks: boolean;
  onShareLink: () => void;
  linkCopied: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Delivery | null>(null);

  async function exportFile() {
    setBusy(true);
    setError(null);
    haptic.light();
    const res = await exportRoutineFile(routineId);
    if (!res.ok) {
      setBusy(false);
      setError(res.error);
      return;
    }
    try {
      const how = await deliver(res.data!.filename, res.data!.json);
      setDone(how);
      window.setTimeout(() => setDone(null), 2500);
    } catch {
      setError("Couldn't save the file");
    }
    setBusy(false);
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Share ${routineName}`}>
      <div className="space-y-2 px-4 pb-5 text-left">
        {linkWorks && (
          <Button block variant="solid" onClick={onShareLink}>
            <Link2 className="size-4" />
            {linkCopied ? "Link copied" : "Share link"}
          </Button>
        )}

        <Button block variant="solid" loading={busy} onClick={exportFile}>
          <Download className="size-4" />
          {done === "copied"
            ? "Copied as text"
            : done
              ? "File ready"
              : "Export file (.json)"}
        </Button>
        <p className="text-text-3 text-[13px] leading-relaxed">
          A file you can send to anyone, on any account. Custom exercises come
          with it — whoever imports it gets their own copy of each.
        </p>

        {error && <p className="text-danger text-[13px]">{error}</p>}
      </div>
    </Sheet>
  );
}

/**
 * Import: pick a file, read what it would do, then commit.
 *
 * The preview is not ceremony. An import writes rows into a library that can
 * only ever be archived, never deleted, so "this creates 2 new exercises" is
 * something a person should get to read before it happens rather than
 * discover afterwards.
 */
export function ImportRoutineButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setJson(null);
    setPreview(null);
    setError(null);
    setBusy(false);
  }

  async function pick(file: File | undefined) {
    // Never branch on `file.type`: iOS reports "" for a .json arriving from
    // Files or a Messages attachment. The format discriminator inside the
    // document is what identifies it, and the server checks that.
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is too large to be a routine");
      setPreview(null);
      setJson("");
      return;
    }

    setBusy(true);
    setError(null);
    const text = await file.text();
    const res = await previewRoutineImport(text);
    setBusy(false);
    if (!res.ok) {
      setJson("");
      setPreview(null);
      setError(res.error);
      return;
    }
    setJson(text);
    setPreview(res.data!);
  }

  async function commit() {
    if (!json) return;
    setBusy(true);
    setError(null);
    const res = await importRoutine(json);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    haptic.light();
    reset();
    router.push(`/routines/${res.data!.routineId}`);
    router.refresh();
  }

  const open = json !== null;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        // Extension first: iOS Files filters by UTI and greys out perfectly
        // valid files when given only the MIME type.
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          // Let the same file be picked twice in a row after a failure.
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={className}
      >
        {children}
      </button>

      <Sheet
        open={open}
        onClose={reset}
        title={preview ? "Import routine" : "Import"}
        footer={
          preview ? (
            <Button block variant="volt" loading={busy} onClick={commit}>
              <Upload className="size-4" />
              Import routine
            </Button>
          ) : undefined
        }
      >
        {/* text-left explicitly: one of the two entry points is inside the
            routines EmptyState, which centres its action slot, and the sheet
            renders in that subtree — so the same preview came out centred from
            one button and left-aligned from the other. */}
        <div className="px-4 pb-5 text-left">
          {error ? (
            <p className="text-danger text-[14px] leading-relaxed">{error}</p>
          ) : !preview ? (
            <p className="text-text-3 py-6 text-center text-[14px]">
              Reading that file…
            </p>
          ) : (
            <>
              <p className="font-display text-[22px] leading-tight font-semibold">
                {preview.name}
              </p>
              <p className="text-text-3 mt-1 text-[13px]">
                <span className="num">{preview.exerciseCount}</span>{" "}
                {preview.exerciseCount === 1 ? "exercise" : "exercises"} ·{" "}
                <span className="num">{preview.setCount}</span>{" "}
                {preview.setCount === 1 ? "set" : "sets"}
                {preview.newCustomCount > 0 && (
                  <>
                    {" · adds "}
                    <span className="num">{preview.newCustomCount}</span> to
                    your exercises
                  </>
                )}
              </p>

              <div className="divide-hairline mt-4 divide-y">
                {preview.exercises.map((e, i) => (
                  <div
                    key={`${e.name}-${i}`}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">
                        {e.name}
                      </p>
                      <p className="text-text-3 truncate text-[12px]">
                        {labelize(e.primaryMuscle)} · {labelize(e.equipment)} ·{" "}
                        <span className="num">{e.sets}</span>{" "}
                        {e.sets === 1 ? "set" : "sets"}
                      </p>
                    </div>
                    {/* Neutral, and only on the rows that actually create
                        something — the rest already exist and need no label. */}
                    {e.resolution === "new" && <Badge>New</Badge>}
                  </div>
                ))}
              </div>

              {preview.newCustomCount > 0 && (
                <p className="text-text-3 mt-4 flex items-start gap-2 text-[13px] leading-relaxed">
                  <FileJson className="mt-0.5 size-4 shrink-0" />
                  <span>
                    New exercises are added as your own copies. They stay out of
                    exercise search until you add them from the exercise page.
                  </span>
                </p>
              )}
            </>
          )}
        </div>
      </Sheet>
    </>
  );
}
