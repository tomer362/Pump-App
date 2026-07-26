"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search, X } from "lucide-react";
import { Badge, Card, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { ExercisePicker } from "@/components/workout/exercise-picker";
import { searchExercisesAction } from "@/lib/actions/exercise-search";
import type { ExerciseListItem } from "@/lib/queries/exercise";
import { labelize } from "@/lib/utils";

export function ExerciseBrowser({ initial }: { initial: ExerciseListItem[] }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState(initial);
  const [creating, setCreating] = useState(false);
  const debounce = useRef<number | undefined>(undefined);

  useEffect(() => {
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      setItems(await searchExercisesAction({ query }));
    }, 200);
    return () => window.clearTimeout(debounce.current);
  }, [query]);

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

      <Button
        block
        variant="ghost"
        className="mt-3"
        onClick={() => setCreating(true)}
      >
        <Plus className="size-4" strokeWidth={2.6} />
        Create custom exercise
      </Button>

      <Card className="divide-hairline mt-3 divide-y overflow-hidden">
        {items.length === 0 ? (
          <p className="text-text-3 py-8 text-center text-[14px]">
            No exercises match.
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
              {e.isCustom && <Badge>Custom</Badge>}
              <ChevronRight className="text-text-3 size-4 shrink-0" />
            </Link>
          ))
        )}
      </Card>

      {/* Reuses the picker's create form; selecting nothing just closes it. */}
      <ExercisePicker
        open={creating}
        onClose={() => setCreating(false)}
        onConfirm={() => {
          setCreating(false);
          setQuery("");
        }}
      />
    </div>
  );
}

