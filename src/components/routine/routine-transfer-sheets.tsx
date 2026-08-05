"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ClipboardPaste,
  Download,
  FileJson,
  Link2,
  Sparkles,
  Upload,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge, Textarea } from "@/components/ui/primitives";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import {
  exportRoutineFile,
  importRoutine,
  previewRoutineImport,
  type ImportPreview,
} from "@/lib/actions/routine-transfer";
import { buildRoutinePrompt } from "@/lib/routine-prompt";
import { MAX_IMPORT_BYTES } from "@/lib/routine-transfer";
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
 * Import: choose how the document arrives, read what it would do, then commit.
 *
 * The button used to open the file picker outright, which only ever helped
 * someone who had been handed a file. The other way a routine gets written is
 * that someone planned their training in a chat with a model — and that answer
 * lands on the clipboard, never in Files, so a paste path is what makes the
 * prompt worth copying. Hence a menu: file, paste, or copy the prompt that
 * turns the plan in that chat into something the parser accepts.
 *
 * A week is several routines and this imports one document at a time, so the
 * paste path gets used once per training day. That is why it returns to this
 * menu rather than closing the sheet on the way in.
 *
 * The preview is not ceremony. An import writes rows into a library that can
 * only ever be archived, never deleted, so "this creates 2 new exercises" is
 * something a person should get to read before it happens rather than
 * discover afterwards.
 */
type ImportView = "menu" | "paste" | "preview";

export function ImportRoutineButton({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const keyboardInset = useKeyboardInset();
  const [view, setView] = useState<ImportView | null>(null);
  const [json, setJson] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [promptText, setPromptText] = useState<string | null>(null);

  function reset() {
    setView(null);
    setJson(null);
    setPasted("");
    setPreview(null);
    setError(null);
    setBusy(false);
    setCopied(false);
    setPromptText(null);
  }

  /** Shared tail of both arrival paths: preview it, or say why not. */
  async function review(text: string) {
    if (text.length > MAX_IMPORT_BYTES) {
      setPreview(null);
      setError("That file is too large to be a routine");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await previewRoutineImport(text);
    setBusy(false);
    if (!res.ok) {
      setPreview(null);
      setError(res.error);
      return;
    }
    setJson(text);
    setPreview(res.data!);
    setView("preview");
  }

  async function pick(file: File | undefined) {
    // Never branch on `file.type`: iOS reports "" for a .json arriving from
    // Files or a Messages attachment. The format discriminator inside the
    // document is what identifies it, and the server checks that.
    if (!file) return;
    // The same cap the parser enforces. A larger one here only buys a round
    // trip that comes back with this very sentence.
    if (file.size > MAX_IMPORT_BYTES) {
      setError("That file is too large to be a routine");
      setPreview(null);
      return;
    }
    await review(await file.text());
  }

  async function copyPrompt() {
    const text = buildRoutinePrompt();
    setError(null);
    try {
      await navigator.clipboard.writeText(text);
      haptic.light();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard writes are refused outside a secure context and in a few
      // in-app browsers. Show the prompt rather than a dead end — selecting it
      // by hand still gets it where it is going.
      setPromptText(text);
    }
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
        onClick={() => {
          setView("menu");
        }}
        className={className}
      >
        {children}
      </button>

      <Sheet
        open={view !== null}
        onClose={reset}
        title={
          view === "preview"
            ? "Import routine"
            : view === "paste"
              ? "Paste JSON"
              : "Import"
        }
        // A drag anywhere on the panel wins over a child's, so scrolling a
        // screenful of pasted JSON would otherwise dismiss the sheet.
        dragToDismiss={view !== "paste"}
        footer={
          view === "preview" && preview ? (
            <Button block variant="volt" loading={busy} onClick={commit}>
              <Upload className="size-4" />
              Import routine
            </Button>
          ) : view === "paste" ? (
            <Button
              block
              variant="volt"
              loading={busy}
              disabled={!pasted.trim()}
              onClick={() => void review(pasted.trim())}
            >
              Preview import
            </Button>
          ) : undefined
        }
      >
        {/* text-left explicitly: one of the two entry points is inside the
            routines EmptyState, which centres its action slot, and the sheet
            renders in that subtree — so the same preview came out centred from
            one button and left-aligned from the other. */}
        <div
          className="px-4 pb-5 text-left"
          style={{
            paddingBottom: keyboardInset ? keyboardInset + 20 : undefined,
          }}
        >
          {view === "menu" ? (
            <div className="space-y-2">
              <Button
                block
                variant="solid"
                loading={busy}
                onClick={() => inputRef.current?.click()}
              >
                <FileJson className="size-4" />
                Choose a file
              </Button>
              <Button
                block
                variant="solid"
                onClick={() => {
                  setError(null);
                  setPromptText(null);
                  setView("paste");
                }}
              >
                <ClipboardPaste className="size-4" />
                Paste JSON
              </Button>
              <Button block variant="solid" onClick={() => void copyPrompt()}>
                <Sparkles className="size-4" />
                {copied ? "Prompt copied" : "Copy AI prompt"}
              </Button>
              <p className="text-text-3 pt-1 text-[13px] leading-relaxed">
                Planned a week with ChatGPT or Claude? Paste the prompt into
                that same chat and it turns the plan into one JSON block per
                day. Bring them back here with Paste JSON, one at a time.
              </p>

              {promptText && (
                <Textarea
                  readOnly
                  rows={6}
                  value={promptText}
                  onFocus={(e) => e.currentTarget.select()}
                  // Monospace, but never below 16px: iOS zooms the page in on
                  // focusing a smaller field and does not zoom back out.
                  className="mt-2 font-mono"
                />
              )}

              {error && (
                <p className="text-danger pt-1 text-[13px] leading-relaxed">
                  {error}
                </p>
              )}
            </div>
          ) : view === "paste" ? (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setView("menu");
                }}
                className="press tap text-text-3 hover:text-text-1 -ml-1 flex items-center gap-1 py-1 text-[13px] font-semibold"
              >
                <ChevronLeft className="size-4" />
                Back
              </button>
              <Textarea
                rows={8}
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                placeholder="Paste the routine JSON here"
                className="font-mono"
              />
              {/* The text stays put on a rejection — retyping a model's answer
                  is not a reasonable ask. */}
              {error && (
                <p className="text-danger text-[13px] leading-relaxed">
                  {error}
                </p>
              )}
            </div>
          ) : error ? (
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
