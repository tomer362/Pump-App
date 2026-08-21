import { notFound } from "next/navigation";
import Link from "next/link";
import { NavBar } from "@/components/ui/nav-bar";
import { Badge } from "@/components/ui/primitives";
import { requireUser } from "@/lib/session";
import { getFullRoutine, getFolders } from "@/lib/queries/routine";
import { getActiveWorkoutSummary } from "@/lib/queries/workout";
import { RoutineActions } from "./routine-actions";
import { RoutineLikeButton } from "@/components/routine/routine-like-button";
import { folderRail } from "@/lib/folder-color";
import { cn, formatWeight, labelize } from "@/lib/utils";
import { restLabel } from "@/lib/rest";
import { prescribedToken, rpeRangeLabel } from "@/lib/rpe";

export default async function RoutineDetailPage(
  props: PageProps<"/routines/[id]">,
) {
  const { id } = await props.params;
  const me = await requireUser();

  const routine = await getFullRoutine(id, me.id);
  if (!routine) notFound();
  // Private routines are owner-only.
  if (routine.userId !== me.id && !routine.isPublic) notFound();

  const isOwner = routine.userId === me.id;
  const [active, folders] = await Promise.all([
    getActiveWorkoutSummary(me.id),
    isOwner ? getFolders(me.id) : Promise.resolve([]),
  ]);

  const totalSets = routine.exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <div className="pb-8">
      <NavBar
        title={routine.name}
        back
        subtitle={
          isOwner
            ? `${routine.exercises.length} exercises · ${totalSets} sets`
            : `by @${routine.ownerUsername ?? "lifter"}`
        }
      />

      <div className="px-4">
        {/* Provenance: a copied routine credits whoever wrote it, which is
            what makes sharing one feel like sharing rather than taking. */}
        {routine.sourceAuthor && (
          <p className="text-text-3 mb-3 text-[13px]">
            Copied from{" "}
            <Link
              href={`/u/${routine.sourceAuthor}`}
              className="text-volt font-medium"
            >
              @{routine.sourceAuthor}
            </Link>
          </p>
        )}

        {routine.folderName && routine.folderColor && (
          <span className="mb-3 inline-flex items-center gap-2">
            <span
              aria-hidden
              className={cn(
                "h-3.5 w-[3px] rounded-full",
                folderRail(routine.folderColor),
              )}
            />
            <span className="text-text-2 text-[13px]">{routine.folderName}</span>
          </span>
        )}

        {routine.notes && (
          <p className="text-text-2 mb-4 text-[14px] leading-relaxed">
            {routine.notes}
          </p>
        )}

        {/* Reactions sit above the actions: they're about the routine, whereas
            the buttons below are about what you do with it. */}
        <div className="border-hairline mb-4 flex items-center gap-1 border-y py-1">
          <div className="-ml-2.5">
            <RoutineLikeButton
              routineId={routine.id}
              initialLiked={routine.likedByMe}
              initialCount={routine.likeCount}
            />
          </div>
          {routine.saveCount > 0 && (
            <span className="text-text-3 num text-[13px]">
              {routine.saveCount} save{routine.saveCount === 1 ? "" : "s"}
            </span>
          )}
          {isOwner && (
            <span className="text-text-3 ml-auto text-[12px]">
              {routine.isPublic ? "Listed in Discover" : "Private"}
            </span>
          )}
        </div>

        <RoutineActions
          routineId={routine.id}
          routineName={routine.name}
          isOwner={isOwner}
          isPublic={routine.isPublic}
          hasActiveWorkout={active != null}
          folders={folders}
          currentFolderId={routine.folderId}
        />

        <div className="mt-6 space-y-5">
          {routine.exercises.map((e, i) => (
            /* One 28px gutter carries the index, and everything else in the
               block — name, meta, notes, the set table — starts at its right
               edge. Before this the number sat inside the title link, so the
               name began at a different x for a two-digit index than a
               one-digit one and never lined up with the rows beneath it. */
            <div key={e.id} className="grid grid-cols-[1.75rem_minmax(0,1fr)]">
              <span className="text-text-3 num pt-px text-[15px] font-semibold">
                {i + 1}
              </span>

              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2">
                  <Link
                    href={`/exercises/${e.exerciseId}`}
                    className="min-w-0 flex-1 truncate text-[15px] font-semibold"
                  >
                    {e.name}
                  </Link>
                  {/* Superset letter and interval timing ride the right edge:
                      in the gutter they'd fight the index, and inline before
                      the name they'd push it out of the shared column. */}
                  {e.supersetGroup && (
                    <span className="text-volt border-volt/50 grid size-5 shrink-0 place-items-center rounded border text-[10px] font-bold">
                      {e.supersetGroup}
                    </span>
                  )}
                  {e.intervalWorkSeconds != null && (
                    <Badge tone="volt">
                      {e.intervalWorkSeconds}s / {e.intervalRestSeconds ?? 0}s
                    </Badge>
                  )}
                </div>

                <p className="text-text-3 mb-2 text-[12px]">
                  {labelize(e.primaryMuscle)} · {labelize(e.equipment)}
                  {/* `!= null`, not truthiness: 0 is "no rest at all", which is a
                      prescription and not an absence. */}
                  {e.restSeconds != null &&
                    (e.restSeconds === 0
                      ? " · no rest"
                      : ` · rest ${restLabel(e.restSeconds)}`)}
                  {/* A range, not `sets[0]`: a lift ramping 7/8/9 has to say so
                      rather than announce itself as the first set's effort. */}
                  {rpeRangeLabel(e.sets.map((s) => s.targetRpe)) && (
                    <span className="num">
                      {" · RPE "}
                      {rpeRangeLabel(e.sets.map((s) => s.targetRpe))}
                    </span>
                  )}
                </p>

                {e.notes && (
                  <p className="text-text-3 mb-2 text-[13px]">{e.notes}</p>
                )}

                <div className="border-hairline bg-surface-1 divide-hairline divide-y overflow-hidden rounded-[12px] border">
                  {e.sets.map((s, j) => (
                    /* Fixed columns rather than a flex row: the weight is
                       right-aligned against the ×, so every row's numbers
                       stack in one line however wide the values are. */
                    <div
                      key={s.id}
                      className="grid grid-cols-[1.25rem_minmax(0,1fr)_0.75rem_minmax(0,1fr)_1.75rem] items-center gap-x-3 px-3 py-2 text-[13px]"
                    >
                      <span className="num text-text-3 font-bold">
                        {s.setType === "normal"
                          ? j + 1
                          : s.setType === "warmup"
                            ? "W"
                            : s.setType === "drop"
                              ? "D"
                              : "F"}
                      </span>
                      <span className="num text-text-1 truncate text-right font-semibold">
                        {s.targetWeightKg != null
                          ? `${formatWeight(s.targetWeightKg, me.unit)} ${me.unit}`
                          : "—"}
                      </span>
                      <span className="text-text-3 text-center">×</span>
                      <span className="num text-text-1 truncate font-semibold">
                        {s.targetReps != null
                          ? `${s.targetReps} reps`
                          : s.targetSeconds != null
                            ? `${s.targetSeconds}s`
                            : "—"}
                      </span>
                      {/* The prescribed effort, in the same `→8` the workout
                          screen will show on the row: what you were told reads
                          identically before and during. Grayscale — a target is
                          not state you produced, so it never takes the accent.
                          A track of its own even when empty, so the reps above
                          it stay in one column down the table. */}
                      <span className="num text-text-3 text-right">
                        {s.targetRpe != null ? prescribedToken(s.targetRpe) : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
