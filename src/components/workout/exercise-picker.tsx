"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge, Input } from "@/components/ui/primitives";
import { Chip, ExerciseForm } from "@/components/exercise/exercise-form";
import { useExerciseBatches } from "@/components/exercise/use-exercise-batches";
import type { ExerciseListItem } from "@/lib/queries/exercise";
import { MUSCLES, EQUIPMENT } from "@/lib/db/schema";
import { cn, haptic, labelize } from "@/lib/utils";

const MUSCLE_FILTERS = ["all", ...MUSCLES] as const;
const EQUIPMENT_FILTERS = ["all", ...EQUIPMENT] as const;

export function ExercisePicker({
  open,
  onClose,
  onConfirm,
  // Opens straight into the create form. The exercise browser's own "Create
  // custom exercise" button reuses this sheet, and dropping the user into a
  // search list they didn't ask for was one tap of pure confusion.
  startCreating = false,
  // "replace" swaps one movement for another: exactly one row can be selected
  // and the sheet opens on suggestions for `replacing` rather than on the
  // whole library, because the exercise you want is nearly always one of them.
  mode = "add",
  replacing,
  alreadyIn,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (exerciseIds: string[]) => void;
  startCreating?: boolean;
  mode?: "add" | "replace";
  /** The exercise being swapped out — its id and name. Replace mode only. */
  replacing?: { id: string; name: string } | null;
  /**
   * Exercise id → how many times it is already on the board. A count, not a
   * flag: a second block of the same lift is legal, so this marks rather than
   * blocks, and "×2" says more than a tick would.
   */
  alreadyIn?: Record<string, number>;
}) {
  const single = mode === "replace";
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<(typeof MUSCLE_FILTERS)[number]>("all");
  const [equipment, setEquipment] =
    useState<(typeof EQUIPMENT_FILTERS)[number]>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(startCreating);

  // Rows arrive in scroll-driven batches: the sheet paints on the first one
  // instead of waiting for the whole library.
  const { recent, rest, loading, loadingMore, exhausted, sentinelRef, refresh } =
    useExerciseBatches({ query, muscle, equipment }, { enabled: open });

  // Curated alternatives for the movement being swapped out, then same-muscle
  // fallbacks. Only ever fetched for the exercise actually being replaced, and
  // only while that sheet is open.
  // Kept with the id they were fetched for rather than cleared on the way in:
  // that way a result that lands after the sheet has moved on to another
  // exercise is ignored instead of rendered under the wrong heading.
  const [suggestions, setSuggestions] = useState<{
    for: string;
    items: ExerciseListItem[];
  } | null>(null);
  const replacingId = single && open ? (replacing?.id ?? null) : null;
  useEffect(() => {
    if (!replacingId) return;
    let live = true;
    import("@/lib/actions/exercise-search")
      .then((m) => m.getReplacementSuggestionsAction(replacingId))
      .then((items) => {
        if (live) setSuggestions({ for: replacingId, items });
      });
    return () => {
      live = false;
    };
  }, [replacingId]);

  // Reset on the way out rather than in an effect keyed on `open`. Memoised so
  // the sheet below gets a stable prop across the re-render per keystroke.
  const close = useCallback(() => {
    setSelected([]);
    setQuery("");
    setCreating(startCreating);
    onClose();
  }, [onClose, startCreating]);

  // The exercise being replaced is never a candidate to replace itself.
  const excludeId = single ? (replacing?.id ?? null) : null;

  // Suggestions lead the sheet, so they're subject to the same de-duplication
  // as "Recent" — and they only make sense while the list is unfiltered; once
  // the user searches, what they typed is the intent.
  const filtering =
    query.trim() !== "" || muscle !== "all" || equipment !== "all";
  const suggested = useMemo(
    () =>
      filtering || !replacingId || suggestions?.for !== replacingId
        ? []
        : suggestions.items,
    [filtering, replacingId, suggestions],
  );

  const shownRecent = useMemo(() => {
    const above = new Set(suggested.map((e) => e.id));
    return recent.filter((e) => e.id !== excludeId && !above.has(e.id));
  }, [recent, suggested, excludeId]);

  // The alphabetical batches cover the whole library, recent entries included,
  // so drop the duplicates rather than show a row twice.
  const others = useMemo(() => {
    const shown = new Set([
      ...suggested.map((e) => e.id),
      ...shownRecent.map((e) => e.id),
    ]);
    return rest.filter((e) => e.id !== excludeId && !shown.has(e.id));
  }, [rest, suggested, shownRecent, excludeId]);

  const empty = recent.length === 0 && rest.length === 0;

  function toggle(id: string) {
    haptic.light();
    // In replace mode the choice is exclusive — tapping another row moves the
    // selection rather than adding to it.
    if (single) return setSelected((s) => (s[0] === id ? [] : [id]));
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={
        creating
          ? "New exercise"
          : single
            ? "Replace exercise"
            : "Add exercises"
      }
      maxHeight="92dvh"
      footer={
        creating ? undefined : (
          <Button
            block
            variant="volt"
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected)}
          >
            {single
              ? selected.length === 0
                ? "Select a replacement"
                : "Replace exercise"
              : selected.length === 0
                ? "Select exercises"
                : `Add ${selected.length} exercise${selected.length === 1 ? "" : "s"}`}
          </Button>
        )
      }
    >
      {creating ? (
        <ExerciseForm
          // With no list behind it, "Cancel" has to mean "close" — going back
          // to a search the user never opened would be a dead end.
          onCancel={() => (startCreating ? close() : setCreating(false))}
          onSaved={(id) => {
            if (startCreating) return onConfirm([id]);
            setCreating(false);
            setQuery("");
            setSelected((s) => (single ? [id] : [...s, id]));
            // Clearing an already-empty search box is a same-value no-op, so
            // ask for the opening batch again explicitly — otherwise the
            // exercise the user just created isn't in the list behind them.
            refresh();
          }}
        />
      ) : (
        <div>
          {single && replacing && (
            <p className="text-text-3 px-4 pb-2 text-[13px] leading-snug">
              Swapping out{" "}
              <span className="text-text-2 font-medium">{replacing.name}</span>.
              The sets stay; the numbers logged against the old movement don&apos;t.
            </p>
          )}
          <div className="bg-surface-1 sticky top-0 z-10 px-4 pb-2">
            <div className="relative">
              <Search className="text-text-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search exercises"
                className="pl-9"
                autoCapitalize="none"
                autoCorrect="off"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-text-3 absolute top-1/2 right-2 -translate-y-1/2 p-2"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {MUSCLE_FILTERS.map((m) => (
                <Chip
                  key={m}
                  active={muscle === m}
                  onClick={() => setMuscle(m)}
                  label={m === "all" ? "All muscles" : labelize(m)}
                />
              ))}
            </div>
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {EQUIPMENT_FILTERS.map((eq) => (
                <Chip
                  key={eq}
                  active={equipment === eq}
                  onClick={() => setEquipment(eq)}
                  label={eq === "all" ? "All equipment" : labelize(eq)}
                />
              ))}
            </div>
          </div>

          {loading && empty ? (
            <p className="text-text-3 py-10 text-center text-[14px]">Loading…</p>
          ) : empty ? (
            <div className="px-4 py-10 text-center">
              <p className="text-text-2 text-[15px]">No exercises match.</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setCreating(true)}
              >
                <Plus className="size-4" />
                Create &ldquo;{query || "custom exercise"}&rdquo;
              </Button>
            </div>
          ) : (
            <>
              {suggested.length > 0 && (
                <Group title="Similar exercises">
                  {suggested.map((e) => (
                    <Row
                      key={e.id}
                      item={e}
                      selected={selected.includes(e.id)}
                      addedCount={alreadyIn?.[e.id] ?? 0}
                      radio={single}
                      onToggle={() => toggle(e.id)}
                    />
                  ))}
                </Group>
              )}
              {shownRecent.length > 0 && (
                <Group title="Recent">
                  {shownRecent.map((e) => (
                    <Row
                      key={e.id}
                      item={e}
                      selected={selected.includes(e.id)}
                      addedCount={alreadyIn?.[e.id] ?? 0}
                      radio={single}
                      onToggle={() => toggle(e.id)}
                    />
                  ))}
                </Group>
              )}
              <Group
                title={
                  suggested.length || shownRecent.length
                    ? "All exercises"
                    : undefined
                }
              >
                {others.map((e) => (
                  <Row
                    key={e.id}
                    item={e}
                    selected={selected.includes(e.id)}
                    addedCount={alreadyIn?.[e.id] ?? 0}
                    radio={single}
                    onToggle={() => toggle(e.id)}
                  />
                ))}
              </Group>

              {/* Sits above the create button so the next batch is already in
                  flight while that button is still below the fold. */}
              {!exhausted && (
                <div ref={sentinelRef} className="flex justify-center py-4">
                  {loadingMore && (
                    <Loader2 className="text-text-3 size-4 animate-spin" />
                  )}
                </div>
              )}

              <div className="px-4 py-4">
                <Button block variant="ghost" onClick={() => setCreating(true)}>
                  <Plus className="size-4" />
                  Create custom exercise
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Group({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      {title && (
        <h4 className="text-text-3 bg-surface-1 px-4 pt-3 pb-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
          {title}
        </h4>
      )}
      <div className="divide-hairline divide-y">{children}</div>
    </div>
  );
}

function Row({
  item,
  selected,
  onToggle,
  addedCount = 0,
  // A replace picker takes exactly one row, and a checkbox that silently
  // unticks the last one you tapped reads as a bug.
  radio = false,
}: {
  item: ExerciseListItem;
  selected: boolean;
  onToggle: () => void;
  addedCount?: number;
  radio?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      // Volt and pr-gold are indistinguishable to a colourblind reader, so the
      // badge below can't be the only carrier — the count goes in the row's
      // accessible name too. "Added" rather than "in this workout": the routine
      // builder uses this same picker, where there is no workout yet.
      aria-label={
        addedCount > 0
          ? `${item.name}, already added${addedCount > 1 ? ` ${addedCount} times` : ""}`
          : undefined
      }
      className={cn(
        "press flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        selected && "bg-volt-fade",
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center border transition-colors",
          radio ? "rounded-full" : "rounded-md",
          selected
            ? "border-volt bg-volt text-black"
            : "border-hairline-strong",
        )}
      >
        {selected && <Check className="size-4" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium">
          {item.name}
        </span>
        <span className="text-text-3 block text-[12px]">
          {labelize(item.primaryMuscle)} · {labelize(item.equipment)}
        </span>
      </span>
      {item.isCustom && <Badge className="shrink-0">Custom</Badge>}
      {addedCount > 0 && (
        // Neutral once the row is selected: a selected row is already volt-tinted
        // with a volt checkbox, and a second volt element on the same row spends
        // the accent on decoration. The marker only needs to shout before you
        // have touched it.
        <Badge
          tone={selected ? "neutral" : "volt"}
          className="shrink-0 whitespace-nowrap"
        >
          Added{addedCount > 1 && <span className="num">×{addedCount}</span>}
        </Badge>
      )}
    </button>
  );
}
