import Link from "next/link";
import { Dumbbell, Plus, Users } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { EmptyState, SectionTitle } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { getRoutines } from "@/lib/queries/routine";
import { getActiveWorkoutSummary } from "@/lib/queries/workout";
import { StartControls } from "./start-controls";
import { RoutineStartCard } from "./routine-start-card";

export default async function StartPage() {
  const me = await requireUser();
  const [routines, active] = await Promise.all([
    getRoutines(me.id),
    getActiveWorkoutSummary(me.id),
  ]);

  return (
    <div>
      <NavBar title="Start" subtitle="Pick a routine or go freestyle" />

      <div className="px-safe-4 pb-6">
        <StartControls activeWorkoutId={active?.id ?? null} />
      </div>

      <div className="px-safe-4 pb-4">
        <SectionTitle
          action={
            <Link
              href="/routines/new"
              className="text-volt flex items-center gap-1 text-[13px] font-semibold"
            >
              <Plus className="size-3.5" strokeWidth={2.8} />
              New
            </Link>
          }
        >
          Your routines
        </SectionTitle>

        {routines.length === 0 ? (
          <EmptyState
            icon={Dumbbell}
            title="No routines yet"
            body="Build a routine once and every future session pre-fills itself — sets, reps and last week's weights."
            action={
              <Link href="/routines/new">
                <Button variant="volt">
                  <Plus className="size-4" strokeWidth={2.6} />
                  Create a routine
                </Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-2">
            {routines.map((r) => (
              <RoutineStartCard
                key={r.id}
                routine={r}
                disabled={active != null}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-safe-4 pb-8">
        <SectionTitle>Train with someone</SectionTitle>
        <Link href="/coop">
          <div className="press border-hairline bg-surface-1 rounded-card flex items-center gap-3 border px-4 py-3.5">
            <span className="bg-surface-2 text-volt grid size-10 shrink-0 place-items-center rounded-full">
              <Users className="size-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold">Co-op session</p>
              <p className="text-text-3 text-[13px]">
                Share a code, lift together, see each other&apos;s sets live
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
