import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { Badge, Card, Stat } from "@/components/ui/primitives";
import { WorkoutDetailActions } from "./workout-detail-actions";
import { requireUser } from "@/lib/session";
import { getFullWorkout, getPersonalRecords } from "@/lib/queries/workout";
import {
  formatDayLabel,
  formatDurationLong,
  formatVolume,
  formatWeight,
  labelize,
} from "@/lib/utils";

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
            const working = e.sets.filter((s) => s.setType !== "warmup");
            const volume = working.reduce(
              (n, s) => n + (s.weightKg ?? 0) * (s.reps ?? 0),
              0,
            );
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
                  {labelize(e.primaryMuscle)} · {e.sets.length} set
                  {e.sets.length === 1 ? "" : "s"} ·{" "}
                  {formatVolume(volume, me.unit)} {me.unit}
                </p>

                {e.notes && (
                  <p className="text-text-3 mb-2 text-[13px]">{e.notes}</p>
                )}

                <Card className="divide-hairline divide-y overflow-hidden">
                  {e.sets.map((s, i) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-3 px-3 py-2 text-[13px]"
                    >
                      <span className="num text-text-3 w-5 shrink-0 font-bold">
                        {s.setType === "normal"
                          ? i + 1
                          : s.setType === "warmup"
                            ? "W"
                            : s.setType === "drop"
                              ? "D"
                              : "F"}
                      </span>
                      <span className="num text-text-1 font-semibold">
                        {s.weightKg != null
                          ? `${formatWeight(s.weightKg, me.unit)} ${me.unit}`
                          : "—"}
                      </span>
                      {s.reps != null && (
                        <>
                          <span className="text-text-3">×</span>
                          <span className="num text-text-1 font-semibold">
                            {s.reps}
                          </span>
                        </>
                      )}
                      {s.seconds != null && (
                        <span className="num text-text-1 font-semibold">
                          {s.seconds}s
                        </span>
                      )}
                      {s.rpe != null && (
                        <span className="num text-text-3 ml-auto text-[12px]">
                          RPE {s.rpe}
                        </span>
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
