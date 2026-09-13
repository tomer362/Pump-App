"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ChevronRight, Loader2, Plus, Search, X } from "lucide-react";
import {
  Badge,
  Card,
  HighlightedText,
  Input,
  Segmented,
} from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/exercise/exercise-form";
import { useExerciseBatches } from "@/components/exercise/use-exercise-batches";
import { QuickLogLauncher } from "@/components/exercise/quick-log-sheet";
import {
  ImportedReveal,
  importedRevealState,
} from "@/components/exercise/imported-reveal";
import type { ExerciseBatch } from "@/lib/actions/exercise-search";
import type { ExerciseListItem, ExerciseScope } from "@/lib/queries/exercise";
import { MUSCLES } from "@/lib/db/schema";
import type { Muscle } from "@/lib/db/schema";
import { useRouteMemory } from "@/hooks/use-route-memory";
import { labelize } from "@/lib/utils";

// Behind a gesture, so it stays out of the initial payload.
const ExercisePicker = dynamic(() =>
  import("@/components/workout/exercise-picker").then((m) => m.ExercisePicker),
);

const SCOPES = [
  { value: "available" as const, label: "All" },
  { value: "mine" as const, label: "Mine" },
  // Four disjoint slices is the honest structure now that a fourth exists —
  // an exercise is built-in, yours, imported, or archived.
  { value: "imported" as const, label: "Imported" },
  { value: "archived" as const, label: "Archived" },
];

const MUSCLE_FILTERS = ["all", ...MUSCLES] as const;

type Filters = { query: string; scope: ExerciseScope; muscle: Muscle | "all" };

const NO_FILTERS: Filters = { query: "", scope: "available", muscle: "all" };

/** A stored shape from an older build must not load. */
function reviveFilters(value: unknown): Filters | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.query !== "string") return null;
  if (!SCOPES.some((s) => s.value === v.scope)) return null;
  if (!MUSCLE_FILTERS.some((m) => m === v.muscle)) return null;
  return {
    query: v.query,
    scope: v.scope as ExerciseScope,
    muscle: v.muscle as Muscle | "all",
  };
}

export function ExerciseBrowser({
  initial,
  unit,
}: {
  initial: ExerciseBatch;
  unit: "kg" | "lb";
}) {
  // One memory for the three of them: opening an exercise and coming back to
  // an unfiltered library is the same lost place as coming back to the top of
  // one. The batches below are cached under the same route, so a restored
  // search shows its own rows rather than refetching them.
  const [filters, setFilters] = useRouteMemory<Filters>(
    "exercise-filters",
    NO_FILTERS,
    reviveFilters,
  );
  const { query, scope, muscle } = filters;
  const setQuery = (next: string) => setFilters({ ...filters, query: next });
  const setScope = (next: ExerciseScope) => setFilters({ ...filters, scope: next });
  const setMuscle = (next: Muscle | "all") => setFilters({ ...filters, muscle: next });
  const [creating, setCreating] = useState(false);

  const [showImported, setShowImported] = useState(false);

  // The first batch is server-rendered, the rest arrive as the user scrolls.
  const { recent, rest, imported, loadingMore, exhausted, sentinelRef, refresh } =
    useExerciseBatches(
      { query, scope, muscle },
      { initial, initialFor: NO_FILTERS, persistKey: "exercises" },
    );

  const reveal = importedRevealState(imported);

  // Recent entries are pinned on top and also appear in the alphabetical
  // batches — show each row once.
  const items = useMemo(() => {
    const shown = new Set(recent.map((e) => e.id));
    return [...recent, ...rest.filter((e) => !shown.has(e.id))];
  }, [recent, rest]);

  // The quick-log shortcut is offered on recently-trained rows only. Recent is
  // "what you have actually done", so it is where a repeat log happens; hanging
  // a control off all 249 built-ins would be 249 targets for a gesture almost
  // nobody wants there.
  const recentIds = useMemo(() => new Set(recent.map((e) => e.id)), [recent]);
  const [quickLogFor, setQuickLogFor] = useState<ExerciseListItem | null>(null);

  return (
    <div className="px-4">
      <div className="relative">
        <Search className="text-text-3 pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          type="search"
          enterKeyHint="search"
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

      <Segmented
        className="mt-3"
        value={scope}
        onChange={setScope}
        options={SCOPES}
      />

      {/* A group, not eighteen unrelated buttons. Without it a screen reader
          reads out "Lats, button" with nothing saying what it filters, and the
          6px between chips reads as two targets rather than two options of
          one — which is the difference between a mis-tap that costs a tap and
          one that costs you the screen. */}
      <div
        role="group"
        aria-label="Filter by muscle"
        className="scrollbar-none -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1"
      >
        {MUSCLE_FILTERS.map((m) => (
          <Chip
            key={m}
            active={muscle === m}
            onClick={() => setMuscle(m)}
            label={m === "all" ? "All muscles" : labelize(m)}
          />
        ))}
      </div>

      {scope !== "archived" && scope !== "imported" && (
        <Button
          block
          variant="ghost"
          className="mt-3"
          onClick={() => setCreating(true)}
        >
          <Plus className="size-4" strokeWidth={2.6} />
          Create custom exercise
        </Button>
      )}

      <Card className="divide-hairline mt-3 divide-y overflow-hidden">
        {items.length === 0 ? (
          <p className="text-text-3 py-8 text-center text-[14px]">
            {scope === "archived"
              ? "Nothing archived."
              : scope === "mine"
                ? "You haven't created any exercises yet."
                : scope === "imported"
                  ? "Nothing imported yet — routines you import bring their custom exercises with them."
                  : "No exercises match."}
          </p>
        ) : (
          items.map((e) => (
            <Row
              key={e.id}
              item={e}
              onQuickLog={
                recentIds.has(e.id) && !e.isArchived
                  ? () => setQuickLogFor(e)
                  : undefined
              }
            />
          ))
        )}

        {/* Last, so material the scope hides never pushes down material it
            shows. With no in-scope results, last is the top, and the rule
            still holds without a special case. */}
        {reveal.show && (
          <>
            <ImportedReveal
              count={reveal.count}
              capped={reveal.capped}
              open={showImported}
              onToggle={() => setShowImported((v) => !v)}
            />
            {showImported && reveal.rows.map((e) => <Row key={e.id} item={e} />)}
          </>
        )}
      </Card>

      {/* Requested ~600px before it reaches the viewport, so the next batch is
          usually already rendered by the time the user scrolls that far. */}
      {!exhausted && (
        <div ref={sentinelRef} className="flex justify-center py-4">
          {loadingMore && <Loader2 className="text-text-3 size-4 animate-spin" />}
        </div>
      )}

      {quickLogFor && (
        <QuickLogLauncher
          exerciseId={quickLogFor.id}
          unit={unit}
          onClose={() => setQuickLogFor(null)}
        />
      )}

      {/* Reuses the picker's sheet, opened straight into the create form. */}
      <ExercisePicker
        startCreating
        open={creating}
        onClose={() => setCreating(false)}
        onConfirm={() => {
          setCreating(false);
          setQuery("");
          // Refetch explicitly rather than relying on the filter change: when
          // the search box was already empty (the common case — this is the
          // default state), setQuery("") is a same-value no-op and the
          // signature never changes, so a newly created exercise silently
          // didn't appear until an unrelated reload.
          refresh();
        }}
      />
    </div>
  );
}

function Row({
  item,
  onQuickLog,
}: {
  item: ExerciseListItem;
  onQuickLog?: () => void;
}) {
  const link = (
    <Link
      href={`/exercises/${item.id}`}
      className="press flex min-w-0 flex-1 items-center gap-3 py-3 pl-4"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">
          <HighlightedText text={item.name} ranges={item.matchRanges} />
        </p>
        <p className="text-text-3 truncate text-[12px]">
          {labelize(item.primaryMuscle)} · {labelize(item.equipment)}
        </p>
      </div>
      {item.isArchived ? (
        <Archive className="text-text-3 size-4 shrink-0" />
      ) : item.isImported ? (
        // Every imported exercise is also custom, so the more specific label
        // wins — two badges on one row would say the same thing twice.
        <Badge>Imported</Badge>
      ) : (
        item.isCustom && <Badge>Custom</Badge>
      )}
      {!onQuickLog && <ChevronRight className="text-text-3 mr-4 size-4 shrink-0" />}
    </Link>
  );

  if (!onQuickLog) return link;

  // A sibling of the link, never a child: a button inside an anchor is invalid
  // and taps on it would still navigate.
  return (
    <div className="flex items-stretch">
      {link}
      <button
        onClick={onQuickLog}
        aria-label={`Log a set of ${item.name}`}
        className="press tap text-volt grid w-12 shrink-0 place-items-center"
      >
        <Plus className="size-5" strokeWidth={2.8} />
      </button>
    </div>
  );
}
