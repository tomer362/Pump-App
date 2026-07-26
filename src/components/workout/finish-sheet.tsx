"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Lock } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/primitives";
import { WorkoutCelebration } from "./celebration";
import { finishWorkout, type FinishSummary } from "@/lib/actions/workout";
import { cn } from "@/lib/utils";

export function FinishSheet({
  open,
  onClose,
  workoutId,
  defaultName,
  defaultNote,
  unit,
  onNameChange,
  onNoteChange,
}: {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  defaultName: string;
  defaultNote: string;
  unit: "kg" | "lb";
  onNameChange: (v: string) => void;
  onNoteChange: (v: string) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState(defaultNote);
  const [share, setShare] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinishSummary | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await finishWorkout(workoutId, {
      shareToFeed: share,
      caption: note || null,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Celebrate first; the sheet closes underneath it.
    setSummary(res.data!);
  }

  return (
    <>
      <Sheet
        open={open && summary == null}
        onClose={onClose}
        title="Finish workout"
        footer={
          <Button block variant="volt" onClick={submit} loading={saving}>
            Finish and save
          </Button>
        }
      >
        <div className="space-y-5 px-4 pb-4">
          <div>
            <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Workout name
            </p>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                onNameChange(e.target.value);
              }}
              maxLength={80}
            />
          </div>

          <div>
            <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              How did it go?
            </p>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                onNoteChange(e.target.value);
              }}
              placeholder="Optional note — energy, niggles, what to change next time."
              maxLength={1000}
            />
          </div>

          <div>
            <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
              Visibility
            </p>
            <div className="flex gap-2">
              <VisibilityOption
                active={share}
                onClick={() => setShare(true)}
                icon={<Globe className="size-4" />}
                title="Share"
                subtitle="Appears in your friends' feed"
              />
              <VisibilityOption
                active={!share}
                onClick={() => setShare(false)}
                icon={<Lock className="size-4" />}
                title="Private"
                subtitle="Only you can see it"
              />
            </div>
          </div>

          {error && <p className="text-danger text-[13px]">{error}</p>}
        </div>
      </Sheet>

      {summary && (
        <WorkoutCelebration
          summary={summary}
          unit={unit}
          onDone={() => {
            setSummary(null);
            router.replace(`/history/${summary.workoutId}`);
            // The finish action skips revalidation so the celebration can
            // play; catch the rest of the app up now.
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function VisibilityOption({
  active,
  onClick,
  icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press rounded-field flex-1 border p-3 text-left transition-colors",
        active
          ? "border-volt bg-volt-fade"
          : "border-hairline bg-surface-2",
      )}
    >
      <span className={cn("flex items-center gap-1.5", active && "text-volt")}>
        {icon}
        <span className="text-[14px] font-semibold">{title}</span>
      </span>
      <span className="text-text-3 mt-0.5 block text-[12px] leading-snug">
        {subtitle}
      </span>
    </button>
  );
}
