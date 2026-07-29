"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, ChevronRight, Plus, Search, X } from "lucide-react";
import { Badge, Card, Input, Segmented } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ExercisePicker } from "@/components/workout/exercise-picker";
import { Chip } from "@/components/exercise/exercise-form";
import { searchExercisesAction } from "@/lib/actions/exercise-search";
import type { ExerciseListItem, ExerciseScope } from "@/lib/queries/exercise";
import { MUSCLES } from "@/lib/db/schema";
import type { Muscle } from "@/lib/db/schema";
import { labelize } from "@/lib/utils";

const SCOPES = [
  { value: "available" as const, label: "All" },
  { value: "mine" as const, label: "Mine" },
  { value: "archived" as const, label: "Archived" },
];

const MUSCLE_FILTERS = ["all", ...MUSCLES] as const;

export function ExerciseBrowser({ initial }: { initial: ExerciseListItem[] }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ExerciseScope>("available");
  const [muscle, setMuscle] = useState<Muscle | "all">("all");
  const [items, setItems] = useState(initial);
  const [creating, setCreating] = useState(false);
  const debounce = useRef<number | undefined>(undefined);

  const search = useCallback(
    async (q: string, s: ExerciseScope, m: Muscle | "all") => {
      setItems(await searchExercisesAction({ query: q, scope: s, muscle: m }));
    },
    [],
  );

  useEffect(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(
      () => void search(query, scope, muscle),
      200,
    );
    return () => window.clearTimeout(debounce.current);
  }, [query, scope, muscle, search]);

  return (
    <div className="px-4">
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

      <Segmented
        className="mt-3"
        value={scope}
        onChange={setScope}
        options={SCOPES}
      />

      <div className="scrollbar-none -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        {MUSCLE_FILTERS.map((m) => (
          <Chip
            key={m}
            active={muscle === m}
            onClick={() => setMuscle(m)}
            label={m === "all" ? "All muscles" : labelize(m)}
          />
        ))}
      </div>

      {scope !== "archived" && (
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
                : "No exercises match."}
          </p>
        ) : (
          items.map((e) => (
            <Link
              key={e.id}
              href={`/exercises/${e.id}`}
              className="press flex items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium">{e.name}</p>
                <p className="text-text-3 truncate text-[12px]">
                  {labelize(e.primaryMuscle)} · {labelize(e.equipment)}
                </p>
              </div>
              {e.isArchived ? (
                <Archive className="text-text-3 size-4 shrink-0" />
              ) : (
                e.isCustom && <Badge>Custom</Badge>
              )}
              <ChevronRight className="text-text-3 size-4 shrink-0" />
            </Link>
          ))
        )}
      </Card>

      {/* Reuses the picker's sheet, opened straight into the create form. */}
      <ExercisePicker
        startCreating
        open={creating}
        onClose={() => setCreating(false)}
        onConfirm={() => {
          setCreating(false);
          setQuery("");
          // Refetch directly rather than relying on the effect above: when
          // the search box was already empty (the common case — this is the
          // default state), setQuery("") is a same-value no-op and the
          // [query]-keyed effect never reruns, so a newly created exercise
          // silently didn't appear until an unrelated reload.
          void search("", scope, muscle);
        }}
      />
    </div>
  );
}
