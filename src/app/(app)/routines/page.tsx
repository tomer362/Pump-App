import { Suspense } from "react";
import Link from "next/link";
import { ListChecks, Plus, Upload, Users } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { SkeletonRows } from "@/components/ui/skeleton";
import { EmptyState, SectionTitle, Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { MyRoutines } from "@/components/routine/my-routines";
import { DiscoverList } from "@/components/routine/discover-list";
import { ImportRoutineButton } from "@/components/routine/routine-transfer-sheets";
import { RoutinesTabs } from "./routines-tabs";
import { requireUser } from "@/lib/session";
import {
  getDiscoverRoutines,
  getFolders,
  getFollowedRoutines,
  getRoutines,
  DISCOVER_SORTS,
  type DiscoverSort,
} from "@/lib/queries/routine";
import { getActiveWorkoutSummary } from "@/lib/queries/workout";
import { DISCOVER_PAGE_SIZE } from "@/lib/pagination";

export default async function RoutinesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string }>;
}) {
  const me = await requireUser();
  const params = await searchParams;
  // The tab lives in the URL rather than in state: back returns to the list you
  // were reading, and a shared link opens on the right one.
  const discover = params.tab === "discover";
  const sort: DiscoverSort = DISCOVER_SORTS.includes(
    params.sort as DiscoverSort,
  )
    ? (params.sort as DiscoverSort)
    : "popular";

  return (
    <div>
      <NavBar
        title="Routines"
        right={
          <Link
            href="/routines/new"
            aria-label="New routine"
            className="press tap text-volt grid place-items-center px-2"
          >
            <Plus className="size-6" strokeWidth={2.6} />
          </Link>
        }
      />

      <div className="px-safe-4 pb-8">
        <RoutinesTabs active={discover ? "discover" : "mine"} sort={sort} />
        {/* The segmented control and the nav bar paint immediately; only the
            list waits on its queries. Keyed on the tab so switching shows the
            skeleton rather than the previous tab's rows. */}
        <Suspense
          key={discover ? "discover" : "mine"}
          fallback={
            <div className="mt-4">
              <SkeletonRows rows={4} />
            </div>
          }
        >
          {discover ? (
            <DiscoverPanel userId={me.id} sort={sort} />
          ) : (
            <MinePanel userId={me.id} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

async function MinePanel({ userId }: { userId: string }) {
  const [mine, folders, active] = await Promise.all([
    getRoutines(userId),
    getFolders(userId),
    getActiveWorkoutSummary(userId),
  ]);

  if (mine.length === 0 && folders.length === 0) {
    return (
      <EmptyState
        icon={ListChecks}
        title="No routines yet"
        body="A routine is a template: exercises, sets and target reps. Start one from it and every field is pre-filled."
        action={
          <div className="flex flex-col items-center gap-1">
            <Link href="/routines/new">
              <Button variant="volt">
                <Plus className="size-4" strokeWidth={2.6} />
                Create a routine
              </Button>
            </Link>
            {/* Being handed a friend's file is a real first-run path, and
                until now it had nowhere to go — the import control lived
                only on a screen you reach by already having a routine. */}
            <ImportRoutineButton className="press tap text-text-3 hover:text-text-1 flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold">
              <Upload className="size-4" strokeWidth={2.2} />
              Import
            </ImportRoutineButton>
          </div>
        }
      />
    );
  }

  return (
    <MyRoutines
      routines={mine}
      folders={folders}
      hasActiveWorkout={active != null}
    />
  );
}

async function DiscoverPanel({
  userId,
  sort,
}: {
  userId: string;
  sort: DiscoverSort;
}) {
  const [followed, initial] = await Promise.all([
    getFollowedRoutines(userId),
    getDiscoverRoutines(userId, { sort, limit: DISCOVER_PAGE_SIZE }),
  ]);

  return (
    <div className="space-y-6">
      {followed.length > 0 && (
        <div>
          <SectionTitle>Programs you follow</SectionTitle>
          <div className="space-y-2">
            {followed.map((r) => (
              <Link key={r.id} href={`/routines/${r.id}`}>
                <div className="press border-hairline bg-surface-1 rounded-card flex items-center gap-3 border px-4 py-3.5">
                  <Avatar src={r.ownerImage} name={r.ownerName} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold">
                      {r.name}
                    </p>
                    <p className="text-text-3 truncate text-[12px]">
                      @{r.ownerUsername ?? "lifter"} · {r.exerciseCount}{" "}
                      exercises
                    </p>
                  </div>
                  <Users className="text-text-3 size-4 shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <DiscoverList key={sort} initial={initial} sort={sort} />
    </div>
  );
}
