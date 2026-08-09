"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, CircleDashed, Globe, Lock, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/primitives";
import { PhotoInput } from "@/components/ui/photo-input";
import {
  finishWorkout,
  type FinishSummary,
  type UnfinishedSetsMode,
} from "@/lib/actions/workout";
import { cn, haptic } from "@/lib/utils";
import { endWorkoutActivity } from "@/lib/workout-activity";

// The finish celebration pulls in the whole choreography and (lazily) the
// confetti library, for a screen that appears once at the end of a session.
const WorkoutCelebration = dynamic(() =>
  import("./celebration").then((m) => m.WorkoutCelebration),
);

export function FinishSheet({
  open,
  onClose,
  workoutId,
  defaultName,
  defaultNote,
  unit,
  uploadsEnabled,
  unfinishedCount,
  onNameChange,
  onNoteChange,
  onDiscard,
}: {
  open: boolean;
  onClose: () => void;
  workoutId: string;
  defaultName: string;
  defaultNote: string;
  unit: "kg" | "lb";
  uploadsEnabled: boolean;
  /** Sets left unticked. Above zero, finishing asks what to do with them. */
  unfinishedCount: number;
  onNameChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onDiscard: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [note, setNote] = useState(defaultNote);
  const [share, setShare] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<FinishSummary | null>(null);
  // Defaults to the truthful option: an unticked set was not performed, and
  // silently promoting it would invent volume and fake a personal record.
  const [unfinished, setUnfinished] = useState<UnfinishedSetsMode>("keep");

  async function submit() {
    setSaving(true);
    setError(null);
    const res = await finishWorkout(workoutId, {
      shareToFeed: share,
      caption: note || null,
      photoUrl,
      unfinishedSets: unfinishedCount > 0 ? unfinished : "delete",
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    // Nothing is live any more: drop the lock-screen line, the armed rest alarm
    // and the app-icon badge. Here rather than after the celebration, because
    // the celebration is dismissed by a tap that may never come.
    endWorkoutActivity();
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
            {unfinishedCount > 0 && unfinished === "complete"
              ? "Complete all and save"
              : "Finish and save"}
          </Button>
        }
      >
        <div className="space-y-5 px-4 pb-4">
          {unfinishedCount > 0 && (
            <div>
              <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
                {unfinishedCount} set{unfinishedCount === 1 ? "" : "s"} not
                ticked off
              </p>
              <div className="space-y-2">
                <UnfinishedOption
                  active={unfinished === "complete"}
                  onClick={() => setUnfinished("complete")}
                  icon={<Check className="size-4" strokeWidth={2.6} />}
                  title="Mark them done"
                  subtitle="You did them and forgot to tick. They count toward volume and records."
                />
                <UnfinishedOption
                  active={unfinished === "keep"}
                  onClick={() => setUnfinished("keep")}
                  icon={<CircleDashed className="size-4" strokeWidth={2.4} />}
                  title="Leave them unfinished"
                  subtitle="Saved as skipped. They stay in the log but count for nothing."
                />
              </div>
              <button
                onClick={() => {
                  haptic.light();
                  onDiscard();
                }}
                className="press text-danger tap mt-2 flex w-full items-center justify-center gap-1.5 text-[13px] font-semibold"
              >
                <Trash2 className="size-4" />
                Discard the whole workout
              </button>
            </div>
          )}

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

          {uploadsEnabled && (
            <div>
              <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
                Photo
              </p>
              <PhotoInput
                value={photoUrl}
                onChange={setPhotoUrl}
                prefix="workouts"
                label="Add a photo"
              />
            </div>
          )}

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

/**
 * Full-width rather than side-by-side: the difference between these two is the
 * difference between a real record and an invented one, and the subtitle is
 * what carries that — it has to be readable, not squeezed into half a row.
 */
function UnfinishedOption({
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
      aria-pressed={active}
      className={cn(
        "press rounded-field flex w-full items-start gap-2.5 border p-3 text-left transition-colors",
        active ? "border-volt bg-volt-fade" : "border-hairline bg-surface-2",
      )}
    >
      <span
        className={cn(
          "mt-px shrink-0",
          active ? "text-volt" : "text-text-3",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            "block text-[14px] font-semibold",
            active ? "text-volt" : "text-text-1",
          )}
        >
          {title}
        </span>
        <span className="text-text-3 mt-0.5 block text-[12px] leading-snug">
          {subtitle}
        </span>
      </span>
    </button>
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
