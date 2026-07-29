"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge, Input, Textarea } from "@/components/ui/primitives";
import { searchExercisesAction } from "@/lib/actions/exercise-search";
import { createCustomExercise } from "@/lib/actions/routine";
import type { ExerciseListItem } from "@/lib/queries/exercise";
import { MUSCLES, EQUIPMENT } from "@/lib/db/schema";
import { cn, haptic, labelize } from "@/lib/utils";

const MUSCLE_FILTERS = ["all", ...MUSCLES] as const;
const EQUIPMENT_FILTERS = ["all", ...EQUIPMENT] as const;

export function ExercisePicker({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (exerciseIds: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<(typeof MUSCLE_FILTERS)[number]>("all");
  const [equipment, setEquipment] =
    useState<(typeof EQUIPMENT_FILTERS)[number]>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Results carry the filter signature they were fetched for, so "loading" is
  // derived rather than a second state write on every keystroke.
  const signature = `${query}|${muscle}|${equipment}`;
  const [fetched, setFetched] = useState<{
    key: string;
    rows: ExerciseListItem[];
  } | null>(null);
  const items = useMemo(() => fetched?.rows ?? [], [fetched]);
  const loading = fetched?.key !== signature;

  // Debounce so typing doesn't fire a request per keystroke.
  const debounce = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!open) return;
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      const rows = await searchExercisesAction({ query, muscle, equipment });
      setFetched({ key: signature, rows });
    }, 180);
    return () => window.clearTimeout(debounce.current);
  }, [open, query, muscle, equipment, signature]);

  // Reset on the way out rather than in an effect keyed on `open`. Memoised so
  // the sheet below gets a stable prop across the re-render per keystroke.
  const close = useCallback(() => {
    setSelected([]);
    setQuery("");
    setCreating(false);
    onClose();
  }, [onClose]);

  const grouped = useMemo(() => {
    const recent = items.filter((i) => i.lastPerformedAt);
    const rest = items.filter((i) => !i.lastPerformedAt);
    return { recent, rest };
  }, [items]);

  function toggle(id: string) {
    haptic.light();
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={creating ? "New exercise" : "Add exercises"}
      maxHeight="92dvh"
      footer={
        creating ? undefined : (
          <Button
            block
            variant="volt"
            disabled={selected.length === 0}
            onClick={() => onConfirm(selected)}
          >
            {selected.length === 0
              ? "Select exercises"
              : `Add ${selected.length} exercise${selected.length === 1 ? "" : "s"}`}
          </Button>
        )
      }
    >
      {creating ? (
        <CreateExerciseForm
          onCancel={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setQuery("");
            setSelected((s) => [...s, id]);
          }}
        />
      ) : (
        <div>
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

          {loading && items.length === 0 ? (
            <p className="text-text-3 py-10 text-center text-[14px]">Loading…</p>
          ) : items.length === 0 ? (
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
              {grouped.recent.length > 0 && (
                <Group title="Recent">
                  {grouped.recent.map((e) => (
                    <Row
                      key={e.id}
                      item={e}
                      selected={selected.includes(e.id)}
                      onToggle={() => toggle(e.id)}
                    />
                  ))}
                </Group>
              )}
              <Group title={grouped.recent.length ? "All exercises" : undefined}>
                {grouped.rest.map((e) => (
                  <Row
                    key={e.id}
                    item={e}
                    selected={selected.includes(e.id)}
                    onToggle={() => toggle(e.id)}
                  />
                ))}
              </Group>

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
}: {
  item: ExerciseListItem;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "press flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        selected && "bg-volt-fade",
      )}
    >
      <span
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
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
      {item.isCustom && <Badge>Custom</Badge>}
    </button>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-volt text-black"
          : "bg-surface-2 text-text-2 hover:text-text-1",
      )}
    >
      {label}
    </button>
  );
}

function CreateExerciseForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [muscle, setMuscle] = useState<string>("chest");
  const [equipment, setEquipment] = useState<string>("barbell");
  const [tracking, setTracking] = useState<string>("weight_reps");
  const [instructions, setInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await createCustomExercise({
      name,
      primaryMuscle: muscle,
      equipment,
      trackingType: tracking,
      instructions: instructions.trim() || null,
    });
    setSaving(false);
    if (res.ok && res.data) onCreated(res.data.exerciseId);
    else if (!res.ok) setError(res.error);
  }

  return (
    <div className="space-y-5 px-4 pb-6">
      <div>
        <Label>Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Reverse Nordic Curl"
          autoFocus
        />
      </div>

      <div>
        <Label>Primary muscle</Label>
        <SelectGrid
          value={muscle}
          onChange={setMuscle}
          options={MUSCLES.map((m) => ({ value: m, label: labelize(m) }))}
        />
      </div>

      <div>
        <Label>Equipment</Label>
        <SelectGrid
          value={equipment}
          onChange={setEquipment}
          options={EQUIPMENT.map((e) => ({ value: e, label: labelize(e) }))}
        />
      </div>

      <div>
        <Label>How is it measured?</Label>
        <SelectGrid
          value={tracking}
          onChange={setTracking}
          options={[
            { value: "weight_reps", label: "Weight & reps" },
            { value: "reps", label: "Reps only" },
            { value: "time", label: "Time" },
            { value: "distance_time", label: "Distance & time" },
            { value: "weight_time", label: "Weight & time" },
          ]}
        />
      </div>

      <div>
        <Label>How to do it (optional)</Label>
        <Textarea
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Setup, cues, range of motion — whatever you'd forget in six weeks."
          maxLength={1000}
        />
      </div>

      {error && <p className="text-danger text-[13px]">{error}</p>}

      <div className="flex gap-2">
        <Button variant="ghost" block onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="volt"
          block
          onClick={submit}
          loading={saving}
          disabled={!name.trim()}
        >
          Create
        </Button>
      </div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}

function SelectGrid({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          active={value === o.value}
          onClick={() => onChange(o.value)}
        />
      ))}
    </div>
  );
}
