"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/primitives";
import {
  createCustomExercise,
  updateCustomExercise,
} from "@/lib/actions/exercise";
import { EQUIPMENT, MUSCLES } from "@/lib/db/schema";
import type { Equipment, Muscle, TrackingType } from "@/lib/db/schema";
import { cn, labelize } from "@/lib/utils";

export type ExerciseFormValues = {
  name: string;
  primaryMuscle: Muscle;
  secondaryMuscles: Muscle[];
  equipment: Equipment;
  trackingType: TrackingType;
  instructions: string;
};

const TRACKING_OPTIONS: { value: TrackingType; label: string }[] = [
  { value: "weight_reps", label: "Weight & reps" },
  { value: "reps", label: "Reps only" },
  { value: "time", label: "Time" },
  { value: "distance_time", label: "Distance & time" },
  { value: "weight_time", label: "Weight & time" },
];

/**
 * One form for both creating and editing a custom exercise, so the two can
 * never drift apart. Passing `exerciseId` switches it to edit.
 */
export function ExerciseForm({
  exerciseId,
  initial,
  onCancel,
  onSaved,
  submitLabel,
}: {
  exerciseId?: string;
  initial?: Partial<ExerciseFormValues>;
  onCancel: () => void;
  onSaved: (id: string) => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [muscle, setMuscle] = useState<Muscle>(initial?.primaryMuscle ?? "chest");
  const [secondary, setSecondary] = useState<Muscle[]>(
    initial?.secondaryMuscles ?? [],
  );
  const [equipment, setEquipment] = useState<Equipment>(
    initial?.equipment ?? "barbell",
  );
  const [tracking, setTracking] = useState<TrackingType>(
    initial?.trackingType ?? "weight_reps",
  );
  const [instructions, setInstructions] = useState(initial?.instructions ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const fields = {
      name,
      primaryMuscle: muscle,
      // The primary muscle is already counted in full; listing it again as a
      // secondary would add half a set to its weekly volume on every set.
      secondaryMuscles: secondary.filter((m) => m !== muscle),
      equipment,
      trackingType: tracking,
      instructions: instructions.trim() || null,
    };
    const res = exerciseId
      ? await updateCustomExercise({ ...fields, exerciseId })
      : await createCustomExercise(fields);
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onSaved(exerciseId ?? (res.data as { exerciseId: string }).exerciseId);
  }

  return (
    <div className="space-y-5 px-4 pb-6">
      <div>
        <FieldLabel>Name</FieldLabel>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Reverse Nordic Curl"
          autoFocus={!exerciseId}
        />
      </div>

      <div>
        <FieldLabel>Primary muscle</FieldLabel>
        <ChipGrid
          value={muscle}
          onChange={(v) => setMuscle(v as Muscle)}
          options={MUSCLES.map((m) => ({ value: m, label: labelize(m) }))}
        />
      </div>

      <div>
        <FieldLabel>Also works (optional)</FieldLabel>
        <ChipGrid
          multi
          value={secondary}
          onChange={(v) => setSecondary(v as Muscle[])}
          options={MUSCLES.filter((m) => m !== muscle).map((m) => ({
            value: m,
            label: labelize(m),
          }))}
        />
        <p className="text-text-3 mt-2 text-[12px]">
          Secondary muscles count as half a set in your weekly volume.
        </p>
      </div>

      <div>
        <FieldLabel>Equipment</FieldLabel>
        <ChipGrid
          value={equipment}
          onChange={(v) => setEquipment(v as Equipment)}
          options={EQUIPMENT.map((e) => ({ value: e, label: labelize(e) }))}
        />
      </div>

      <div>
        <FieldLabel>How is it measured?</FieldLabel>
        <ChipGrid
          value={tracking}
          onChange={(v) => setTracking(v as TrackingType)}
          options={TRACKING_OPTIONS}
        />
      </div>

      <div>
        <FieldLabel>How to do it (optional)</FieldLabel>
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
          {submitLabel ?? (exerciseId ? "Save" : "Create")}
        </Button>
      </div>
    </div>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}

export function Chip({
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
      aria-pressed={active}
      className={cn(
        "press shrink-0 rounded-full px-3 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors",
        active ? "bg-volt text-black" : "bg-surface-2 text-text-2 hover:text-text-1",
      )}
    >
      {label}
    </button>
  );
}

function ChipGrid({
  value,
  onChange,
  options,
  multi = false,
}: {
  value: string | string[];
  onChange: (v: string | string[]) => void;
  options: { value: string; label: string }[];
  multi?: boolean;
}) {
  const selected = Array.isArray(value) ? value : [value];
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <Chip
          key={o.value}
          label={o.label}
          active={selected.includes(o.value)}
          onClick={() => {
            if (!multi) return onChange(o.value);
            onChange(
              selected.includes(o.value)
                ? selected.filter((v) => v !== o.value)
                : [...selected, o.value],
            );
          }}
        />
      ))}
    </div>
  );
}
