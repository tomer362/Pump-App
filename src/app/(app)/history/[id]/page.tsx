import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Badge, Card, Stat } from "@/components/ui/primitives";
import { WorkoutDetailActions } from "./workout-detail-actions";
import { SetRpeRow } from "./set-rpe-row";
import { requireUser } from "@/lib/session";
import { getFullWorkout, getPersonalRecords } from "@/lib/queries/workout";
import {
  formatDayLabel,
  formatDurationLong,
  formatVolume,
  formatWeight,
  labelize,
} from "@/lib/utils";
import { prescribedToken, ratedWord } from "@/lib/rpe";

export default async function WorkoutDetailPage(
  props: PageProps<"/history/[id]">,
) {
  const { id } = await props.params;
  const me = await requireUser();

  const workout = await getFullWorkout(id);
  if (!workout) notFound();
  // In-progress sessions belong on the live workout screen.
  if (!workout.endedAt) redirect(`/workout/${workout.id}`);

  const isMine = workout.userId === me.id;
  const prs = isMine ? await getPersonalRecords(me.id) : [];
  const prSetIds = new Set(
    prs
      .filter((p) => p.kind === "1rm" && p.achievedAt >= workout.startedAt)
      .map((p) => p.exerciseId),
  );

  return (
    <div className="pb-8">
      <NavBar
        title={workout.name}
        back
        subtitle={formatDayLabel(new Date(workout.startedAt))}
      />

      <div className="px-4">
        {workout.photoUrl && (
          <div className="bg-surface-2 rounded-card relative mb-4 aspect-[4/3] overflow-hidden">
            <Image
              src={workout.photoUrl}
              alt=""
              fill
              sizes="(max-width: 512px) 100vw, 512px"
              className="object-cover"
            />
          </div>
        )}

        {workout.note && (
          <p className="text-text-2 mb-4 text-[14px] leading-relaxed">
            {workout.note}
          </p>
        )}

        <Card className="grid grid-cols-4 gap-2 px-4 py-3.5">
          <Stat
            label="Time"
            value={formatDurationLong(workout.durationSeconds)}
          />
          <Stat
            label={me.unit}
            value={formatVolume(workout.totalVolumeKg, me.unit)}
            accent
          />
          <Stat label="Sets" value={workout.totalSets} />
          <Stat label="Reps" value={workout.totalReps} />
        </Card>

        {workout.loadMultiplier !== 1 && (
          <p className="text-text-3 mt-3 text-[13px]">
            Run at {Math.round(workout.loadMultiplier * 100)}% of the
            prescribed load.
          </p>
        )}

        {isMine && (
          <div className="mt-4">
            <WorkoutDetailActions
              workoutId={workout.id}
              workoutName={workout.name}
            />
          </div>
        )}

        <div className="mt-6 space-y-5">
          {workout.exercises.map((e) => {
            // A finished workout can still carry sets that were planned and
            // never performed — the lifter chose to record the session as
            // unfinished. They're shown, but they count for nothing.
            const performed = e.sets.filter((s) => s.completedAt != null);
            const skipped = e.sets.length - performed.length;
            const volume = performed
              .filter((s) => s.setType !== "warmup")
              .reduce((n, s) => n + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
            // Warm-ups don't consume a set number, matching how lifters count.
            let workingIndex = 0;
            return (
              <div key={e.id}>
                <div className="mb-1 flex items-center gap-2">
                  {e.supersetGroup && (
                    <span className="text-volt border-volt/50 grid size-5 shrink-0 place-items-center rounded border text-[10px] font-bold">
                      {e.supersetGroup}
                    </span>
                  )}
                  <Link
                    href={`/exercises/${e.exerciseId}`}
                    className="min-w-0 flex-1 truncate text-[15px] font-semibold"
                  >
                    {e.name}
                  </Link>
                  {prSetIds.has(e.exerciseId) && (
                    <Badge tone="pr">
                      <Trophy className="size-3" strokeWidth={2.6} />
                      PR
                    </Badge>
                  )}
                </div>

                <p className="text-text-3 mb-2 text-[12px]">
                  {labelize(e.primaryMuscle)} · {performed.length} set
                  {performed.length === 1 ? "" : "s"} ·{" "}
                  {formatVolume(volume, me.unit)} {me.unit}
                  {skipped > 0 && ` · ${skipped} skipped`}
                </p>

                {e.notes && (
                  <p className="text-text-3 mb-2 text-[13px]">{e.notes}</p>
                )}

                <Card className="divide-hairline divide-y overflow-hidden">
                  {e.sets.map((s) => {
                    const done = s.completedAt != null;
                    if (done && s.setType !== "warmup") workingIndex++;
                    // Only the measures this exercise actually records — a
                    // plank has no weight, a barbell row has no distance.
                    const parts = [
                      s.weightKg != null &&
                        `${formatWeight(s.weightKg, me.unit)} ${me.unit}`,
                      s.reps != null && `${s.reps} reps`,
                      s.distanceM != null && `${s.distanceM} m`,
                      s.seconds != null && `${s.seconds}s`,
                    ].filter((v): v is string => Boolean(v));

                    const glyph = !done
                      ? "–"
                      : s.setType === "normal"
                        ? String(workingIndex)
                        : s.setType === "warmup"
                          ? "W"
                          : s.setType === "drop"
                            ? "D"
                            : "F";

                    // The number and the numbers, shared by both branches below
                    // so the editable row can't drift from the read-only one.
                    const values = (
                      <>
                        <span className="num text-text-3 w-5 shrink-0 font-bold">
                          {glyph}
                        </span>
                        {parts.length === 0 ? (
                          <span className="num text-text-3 font-semibold">
                            —
                          </span>
                        ) : (
                          parts.map((part, j) => (
                            <span key={j} className="contents">
                              {j > 0 && <span className="text-text-3">×</span>}
                              <span
                                className={
                                  done
                                    ? "num text-text-1 font-semibold"
                                    : "num text-text-3 font-semibold line-through"
                                }
                              >
                                {part}
                              </span>
                            </span>
                          ))
                        )}
                      </>
                    );

                    // Your own performed sets stay rateable after the fact —
                    // see `SetRpeRow`. A skipped set is deliberately excluded:
                    // an effort rating on something you didn't do is a
                    // contradiction, not a gap. Someone else's workout is read
                    // only, so it keeps the plain row.
                    if (isMine && done) {
                      return (
                        <SetRpeRow
                          key={s.id}
                          setId={s.id}
                          initialRpe={s.rpe}
                          targetRpe={s.targetRpe}
                          title={`${e.name} · ${
                            s.setType === "normal"
                              ? `Set ${workingIndex}`
                              : s.setType === "warmup"
                                ? "Warm-up"
                                : s.setType === "drop"
                                  ? "Drop set"
                                  : "Set to failure"
                          }`}
                        >
                          {values}
                        </SetRpeRow>
                      );
                    }

                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 px-3 py-2 text-[13px]"
                      >
                        {values}
                        {!done && (
                          <span className="text-text-3 ml-auto text-[11px] font-semibold tracking-[0.06em] uppercase">
                            Skipped
                          </span>
                        )}
                        {/* Someone else's workout, so read only — but it still
                            shows both facts when it has them. */}
                        {done && (s.rpe != null || s.targetRpe != null) && (
                          <span className="num text-text-3 ml-auto flex items-baseline gap-1.5 text-[12px]">
                            {s.targetRpe != null && (
                              <span className="text-text-3/55">
                                {prescribedToken(s.targetRpe)}
                              </span>
                            )}
                            {s.rpe != null && <span>{ratedWord(s.rpe)}</span>}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
