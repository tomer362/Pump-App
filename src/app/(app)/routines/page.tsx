import Link from "next/link";
import { ListChecks, Plus, Users } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { EmptyState, SectionTitle, Avatar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { getRoutines, getFollowedRoutines } from "@/lib/queries/routine";

export default async function RoutinesPage() {
  const me = await requireUser();
  const [mine, followed] = await Promise.all([
    getRoutines(me.id),
    getFollowedRoutines(me.id),
  ]);

  // Grouped by folder, unfiled last: a folder is something you deliberately
  // named, so it outranks the routines you never filed.
  const byFolder = new Map<string | null, typeof mine>();
  for (const r of mine) {
    const list = byFolder.get(r.folder) ?? [];
    list.push(r);
    byFolder.set(r.folder, list);
  }
  const folders = [...byFolder.entries()].sort(([a], [b]) =>
    a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b),
  );

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

      <div className="px-4 pb-8">
        {mine.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No routines yet"
            body="A routine is a template: exercises, sets and target reps. Start one from it and every field is pre-filled."
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
          <div className="space-y-6">
            {folders.map(([folder, list]) => (
              <div key={folder ?? "__none"}>
                {/* Only heading a group when there is more than one — a single
                    "Routines" label above every routine is pure chrome. */}
                {folders.length > 1 && (
                  <SectionTitle>{folder ?? "Unfiled"}</SectionTitle>
                )}
                <div className="space-y-2">
                  {list.map((r) => (
                    <Link key={r.id} href={`/routines/${r.id}`}>
                      <div className="press border-hairline bg-surface-1 rounded-card border px-4 py-3.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-[16px] font-semibold">
                            {r.name}
                          </p>
                          {!r.isPublic && (
                            <span className="text-text-3 shrink-0 text-[11px]">
                              Private
                            </span>
                          )}
                        </div>
                        <p className="text-text-3 num mt-0.5 text-[12px]">
                          {r.exerciseCount} exercise
                          {r.exerciseCount === 1 ? "" : "s"} · {r.setCount} sets
                          {r.sourceAuthor && <> · from @{r.sourceAuthor}</>}
                        </p>
                        {r.preview.length > 0 && (
                          <p className="text-text-3 mt-1.5 truncate text-[13px]">
                            {r.preview.join(" · ")}
                            {r.exerciseCount > r.preview.length && " …"}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {followed.length > 0 && (
          <div className="mt-8">
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
      </div>
    </div>
  );
}
