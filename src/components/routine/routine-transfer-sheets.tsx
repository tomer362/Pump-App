"use client";

import { useRef, useState } from "react";
import { useTransient } from "@/hooks/use-transient";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ClipboardPaste,
  Download,
  FileJson,
  Link2,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge, Textarea } from "@/components/ui/primitives";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import {
  applyRoutineUpdate,
  exportRoutineFile,
  getRoutineUpdatePrompt,
  importRoutine,
  previewRoutineImport,
  previewRoutineUpdate,
  type ImportPreview,
  type UpdatePreview,
  type UpdatePreviewRoutine,
} from "@/lib/actions/routine-transfer";
import { buildRoutinePrompt } from "@/lib/routine-prompt";
import {
  MAX_IMPORT_BYTES,
  MAX_UPDATE_ROUTINES,
  parseAnyRoutineDocument,
} from "@/lib/routine-transfer";
import { cn, haptic, labelize } from "@/lib/utils";

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
  const [done, flashDone] = useTransient<Delivery | null>(null, 2500);

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
      flashDone(how);
    } catch {
      setError("Couldn't save the file");
    }
    setBusy(false);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Share ${routineName}`}
      dismissLabel="Done"
    >
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
 * "Update routines with AI" is the second trip round that loop: pick routines
 * you already have, copy a prompt that carries them, and paste the model's
 * answer into the same Paste box. The box reads either document by its
 * `format`, so there is one way back in however the answer was produced, and
 * the update gets its own preview — a diff, because it rewrites rows you
 * already train from.
 *
 * The preview is not ceremony. An import writes rows into a library that can
 * only ever be archived, never deleted, so "this creates 2 new exercises" is
 * something a person should get to read before it happens rather than
 * discover afterwards.
 */
type ImportView = "menu" | "paste" | "preview" | "select" | "update-preview";

export function ImportRoutineButton({
  className,
  children,
  routines = [],
}: {
  className?: string;
  children: React.ReactNode;
  /** Your routines, for "Update routines with AI". None hides the option. */
  routines?: { id: string; name: string }[];
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
  const [copied, flashCopied, resetCopied] = useTransient(false, 2000);
  const [promptText, setPromptText] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [updatePreview, setUpdatePreview] = useState<UpdatePreview | null>(
    null,
  );
  const [updateCopied, setUpdateCopied] = useState(false);

  function reset() {
    setView(null);
    setJson(null);
    setPasted("");
    setPreview(null);
    setError(null);
    setBusy(false);
    resetCopied();
    setPromptText(null);
    setSelected(new Set());
    setUpdatePreview(null);
    setUpdateCopied(false);
  }

  /** Shared tail of both arrival paths: preview it, or say why not. */
  async function review(text: string) {
    if (text.length > MAX_IMPORT_BYTES) {
      setPreview(null);
      setError("That file is too large to be a routine");
      return;
    }
    // Which document this is decides which preview it gets. The parse is pure
    // and cheap, and a rejection here is the same sentence the server would
    // have sent back — so it saves the round trip; the server re-parses anyway.
    const kind = parseAnyRoutineDocument(text);
    if (!kind.ok) {
      setPreview(null);
      setError(kind.error);
      return;
    }
    setBusy(true);
    setError(null);
    if (kind.kind === "update") {
      const res = await previewRoutineUpdate(text);
      setBusy(false);
      if (!res.ok) {
        setUpdatePreview(null);
        setError(res.error);
        return;
      }
      setJson(text);
      setUpdatePreview(res.data!);
      setView("update-preview");
      return;
    }
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
      flashCopied(true);
    } catch {
      // Clipboard writes are refused outside a secure context and in a few
      // in-app browsers. Show the prompt rather than a dead end — selecting it
      // by hand still gets it where it is going.
      setPromptText(text);
    }
  }

  async function copyUpdatePrompt() {
    setBusy(true);
    setError(null);
    setPromptText(null);
    // Keep the list's order rather than the order things were ticked in: the
    // prompt reads as your week, not as a record of your taps.
    const ids = routines.filter((r) => selected.has(r.id)).map((r) => r.id);
    const res = await getRoutineUpdatePrompt(ids);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const text = res.data!.prompt;
    try {
      await navigator.clipboard.writeText(text);
      haptic.light();
      setUpdateCopied(true);
    } catch {
      setPromptText(text);
    }
    setView("menu");
  }

  async function applyUpdate() {
    if (!json) return;
    setBusy(true);
    setError(null);
    const res = await applyRoutineUpdate(json);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    haptic.light();
    const touched = updatePreview?.routines.filter(
      (r) => r.status !== "unchanged",
    );
    reset();
    // One routine changed: show it. Several: the list is where they all are.
    if (touched?.length === 1) {
      const i = updatePreview!.routines.indexOf(touched[0]);
      router.push(`/routines/${res.data!.routineIds[i]}`);
    }
    router.refresh();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_UPDATE_ROUTINES) next.add(id);
      return next;
    });
  }

  const changeCount =
    updatePreview?.routines.filter((r) => r.status !== "unchanged").length ?? 0;

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
              : view === "select"
                ? "Update with AI"
                : view === "update-preview"
                  ? "Update routines"
                  : "Import"
        }
        // A drag anywhere on the panel wins over a child's, so scrolling a
        // screenful of pasted JSON would otherwise dismiss the sheet.
        dragToDismiss={view !== "paste"}
        // The menu view has no footer action and commits nothing, so it needs
        // a drawn way out; the other two views bring their own footer.
        dismissLabel="Done"
        footer={
          view === "preview" && preview ? (
            <Button block variant="volt" loading={busy} onClick={commit}>
              <Upload className="size-4" />
              Import routine
            </Button>
          ) : view === "update-preview" && updatePreview ? (
            <Button
              block
              variant="volt"
              loading={busy}
              disabled={changeCount === 0}
              onClick={applyUpdate}
            >
              <RefreshCw className="size-4" />
              {changeCount === 0
                ? "Nothing to change"
                : `Apply ${changeCount} ${changeCount === 1 ? "change" : "changes"}`}
            </Button>
          ) : view === "select" ? (
            <Button
              block
              variant="volt"
              loading={busy}
              disabled={selected.size === 0}
              onClick={() => void copyUpdatePrompt()}
            >
              <Sparkles className="size-4" />
              {selected.size === 0
                ? "Pick routines to update"
                : `Copy prompt for ${selected.size}`}
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
              <Button
                block
                variant="solid"
                onClick={() => {
                  setUpdateCopied(false);
                  void copyPrompt();
                }}
              >
                <Sparkles className="size-4" />
                {copied ? "Prompt copied" : "Copy AI prompt"}
              </Button>
              {routines.length > 0 && (
                <Button
                  block
                  variant="solid"
                  onClick={() => {
                    setError(null);
                    setPromptText(null);
                    resetCopied();
                    setUpdateCopied(false);
                    setView("select");
                  }}
                >
                  <RefreshCw className="size-4" />
                  Update routines with AI
                </Button>
              )}
              {updateCopied ? (
                <p className="text-text-2 pt-1 text-[13px] leading-relaxed">
                  Prompt copied. Paste it into the chat where you planned the
                  change, then bring the answer back here with Paste JSON — the
                  whole update is one block.
                </p>
              ) : (
                <p className="text-text-3 pt-1 text-[13px] leading-relaxed">
                  Planned a week with ChatGPT or Claude? Copy AI prompt turns
                  that plan into one JSON block per day — paste them back one
                  at a time.
                  {routines.length > 0 &&
                    " To change routines you already have, Update routines with AI hands the chat your routines and brings the edits back onto the same ones, with no duplicates."}
                </p>
              )}

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
          ) : view === "select" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
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
                <button
                  type="button"
                  onClick={() =>
                    setSelected(
                      selected.size
                        ? new Set()
                        : new Set(
                            routines
                              .slice(0, MAX_UPDATE_ROUTINES)
                              .map((r) => r.id),
                          ),
                    )
                  }
                  className="press hit-slop text-text-3 hover:text-text-1 text-[13px] font-semibold"
                >
                  {selected.size ? "Clear" : "Select all"}
                </button>
              </div>
              <p className="text-text-3 text-[13px] leading-relaxed">
                The prompt carries these routines as they are now. The agent
                sends back only the ones it changes, under the same names, and
                they are updated in place.
              </p>
              <div
                role="group"
                aria-label="Routines to update"
                className="divide-hairline border-hairline divide-y border-y"
              >
                {routines.map((r) => {
                  const on = selected.has(r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggle(r.id)}
                      className="press flex min-h-11 w-full items-center gap-3 py-2.5 text-left"
                    >
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
                          on
                            ? "border-volt bg-volt text-black"
                            : "border-hairline-strong",
                        )}
                      >
                        {on && <Check className="size-4" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                        {r.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selected.size >= MAX_UPDATE_ROUTINES && (
                <p className="text-text-3 text-[13px]">
                  Up to <span className="num">{MAX_UPDATE_ROUTINES}</span>{" "}
                  routines per update.
                </p>
              )}
              {error && (
                <p className="text-danger text-[13px] leading-relaxed">
                  {error}
                </p>
              )}
            </div>
          ) : view === "update-preview" && updatePreview ? (
            <div>
              {error && (
                <p className="text-danger mb-3 text-[13px] leading-relaxed">
                  {error}
                </p>
              )}
              <div className="divide-hairline divide-y">
                {updatePreview.routines.map((r, i) => (
                  <UpdateRoutineRow key={`${r.name}-${i}`} routine={r} />
                ))}
              </div>
              {updatePreview.newExercises.length > 0 && (
                <p className="text-text-3 mt-4 flex items-start gap-2 text-[13px] leading-relaxed">
                  <FileJson className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Adds {updatePreview.newExercises.join(", ")} to your
                    exercises — nothing in your library had{" "}
                    {updatePreview.newExercises.length === 1
                      ? "that name. It stays"
                      : "those names. They stay"}{" "}
                    out of exercise search until you add it from the exercise
                    page.
                  </span>
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
                placeholder="Paste the routine or update JSON here"
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

const STATUS_LABEL: Record<UpdatePreviewRoutine["status"], string> = {
  update: "Updated",
  new: "New",
  unchanged: "No changes",
};

/**
 * One routine of an update. The glyph carries the kind of change, not the
 * colour — grey throughout, since none of this is state the lifter produced.
 */
function UpdateRoutineRow({ routine: r }: { routine: UpdatePreviewRoutine }) {
  const d = r.diff;
  return (
    <div className="py-3">
      <div className="flex items-center gap-3">
        <p className="font-display min-w-0 flex-1 truncate text-[17px] font-semibold">
          {r.name}
        </p>
        <Badge>{STATUS_LABEL[r.status]}</Badge>
      </div>
      <p className="text-text-3 mt-0.5 text-[12px]">
        <span className="num">{r.exerciseCount}</span>{" "}
        {r.exerciseCount === 1 ? "exercise" : "exercises"} ·{" "}
        <span className="num">{r.setCount}</span>{" "}
        {r.setCount === 1 ? "set" : "sets"}
        {r.status === "new" && " · a routine you don't have yet"}
      </p>

      {d && r.status === "update" && (
        <ul className="text-text-2 mt-2 space-y-1 text-[13px] leading-snug">
          {d.nameChanged && <li>~ name written as “{r.name}”</li>}
          {d.notesChanged && <li>~ routine notes</li>}
          {d.lines.map((l, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="num text-text-3 w-3 shrink-0">
                {l.kind === "added" ? "+" : l.kind === "removed" ? "−" : "~"}
              </span>
              <span className="min-w-0">
                <span className="sr-only">
                  {l.kind === "added"
                    ? "Added: "
                    : l.kind === "removed"
                      ? "Removed: "
                      : "Changed: "}
                </span>
                <span className="text-text-1 font-medium">{l.name}</span>
                <span className="text-text-3">
                  {" — "}
                  {l.kind === "changed" ? l.changes.join("; ") : l.detail}
                </span>
              </span>
            </li>
          ))}
          {d.reordered && <li>~ exercise order</li>}
        </ul>
      )}

      {r.status === "new" && (
        <ul className="text-text-3 mt-2 space-y-1 text-[13px]">
          {r.exercises.map((e, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="text-text-2 min-w-0 truncate">{e.name}</span>
              <span className="num shrink-0">
                · {e.sets} {e.sets === 1 ? "set" : "sets"}
              </span>
              {e.resolution === "new" && <Badge>New</Badge>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
