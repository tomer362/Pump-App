"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Bookmark, Check, Compass } from "lucide-react";
import { Avatar, EmptyState, Segmented } from "@/components/ui/primitives";
import { LoadMore } from "@/components/ui/load-more";
import { RoutineLikeButton } from "./routine-like-button";
import { loadMoreDiscoverRoutines } from "@/lib/actions/paginate";
import { copyRoutine } from "@/lib/actions/routine";
import { DISCOVER_PAGE_SIZE, discoverCursor } from "@/lib/pagination";
import { usePagedList } from "@/hooks/use-paged-list";
import type { DiscoverRoutine, DiscoverSort } from "@/lib/queries/routine";
import { haptic } from "@/lib/utils";

/** JSON has no `Date`; `createdAt` is the "new" ordering's cursor. */
function reviveRoutine(value: unknown): DiscoverRoutine {
  const r = value as DiscoverRoutine;
  return { ...r, createdAt: new Date(r.createdAt) };
}

const SORTS = [
  { value: "popular" as const, label: "Popular" },
  { value: "new" as const, label: "New" },
];

export function DiscoverList({
  initial,
  sort,
}: {
  initial: DiscoverRoutine[];
  sort: DiscoverSort;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { items, loading, exhausted, more, failed } = usePagedList({
    initial,
    pageSize: DISCOVER_PAGE_SIZE,
    // The ordering is part of the identity: pages of "popular" must never be
    // restored into "new".
    name: `discover:${sort}`,
    idOf: (r) => r.id,
    revive: reviveRoutine,
    fetchMore: (last) =>
      loadMoreDiscoverRoutines(sort, discoverCursor(last, sort)),
  });

  function setSort(next: DiscoverSort) {
    const q = new URLSearchParams(params.toString());
    q.set("tab", "discover");
    q.set("sort", next);
    // The sort lives in the URL so back returns to the list you were reading,
    // and a reload doesn't silently reorder it.
    router.replace(`${pathname}?${q}`, { scroll: false });
  }

  return (
    <div className="space-y-3">
      <Segmented value={sort} onChange={setSort} options={SORTS} />

      {items.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="Nothing to browse yet"
          body="Routines other people mark as shareable show up here. Once a few exist, the ones people save most rise to the top."
        />
      ) : (
        <>
          {items.map((r) => (
            <DiscoverCard key={r.id} routine={r} />
          ))}
          {!exhausted && (
            <LoadMore
          onClick={more}
          loading={loading}
          label={failed ? "Couldn't load — try again" : "More routines"}
        />
          )}
        </>
      )}
    </div>
  );
}

function DiscoverCard({ routine }: { routine: DiscoverRoutine }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saved || pending) return;
    haptic.light();
    startTransition(async () => {
      const res = await copyRoutine(routine.id);
      if (res.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <Link href={`/routines/${routine.id}`}>
      <div className="press border-hairline bg-surface-1 rounded-card border px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <Avatar
            src={routine.ownerImage}
            name={routine.ownerName}
            size="xs"
          />
          <span className="text-text-3 min-w-0 flex-1 truncate text-[12px]">
            @{routine.ownerUsername ?? "lifter"}
          </span>
          {routine.saveCount > 0 && (
            <span className="text-text-3 num shrink-0 text-[12px]">
              {routine.saveCount} save{routine.saveCount === 1 ? "" : "s"}
            </span>
          )}
        </div>

        <p className="mt-2 truncate text-[16px] font-semibold">{routine.name}</p>
        <p className="text-text-3 num mt-0.5 text-[12px]">
          {routine.exerciseCount} exercise
          {routine.exerciseCount === 1 ? "" : "s"} · {routine.setCount} set
          {routine.setCount === 1 ? "" : "s"}
        </p>
        {routine.preview.length > 0 && (
          <p className="text-text-3 mt-1.5 truncate text-[13px]">
            {routine.preview.join(" · ")}
            {routine.exerciseCount > routine.preview.length && " …"}
          </p>
        )}

        <div className="mt-1.5 -ml-2.5 flex items-center">
          <RoutineLikeButton
            routineId={routine.id}
            initialLiked={routine.likedByMe}
            initialCount={routine.likeCount}
            size="sm"
          />
          <button
            onClick={onSave}
            disabled={saved || pending}
            aria-label={saved ? "Saved to your routines" : "Save to my routines"}
            className="press tap text-text-3 ml-auto flex items-center gap-1.5 px-2.5 py-2 text-[13px] font-semibold disabled:opacity-60"
          >
            {saved ? (
              <>
                <Check className="size-[17px]" strokeWidth={2.4} />
                Saved
              </>
            ) : (
              <>
                <Bookmark className="size-[17px]" strokeWidth={2.2} />
                {pending ? "Saving" : "Save"}
              </>
            )}
          </button>
        </div>

        {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
      </div>
    </Link>
  );
}
