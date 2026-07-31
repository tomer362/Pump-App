import Link from "next/link";
import { Heart } from "lucide-react";
import type { RoutineListItem } from "@/lib/queries/routine";

/**
 * One routine in your own library. Kept presentational and server-renderable —
 * the interactive bits (move, like) live on the routine's own screen, so the
 * list stays a list rather than a grid of controls to mis-tap.
 */
export function RoutineCard({ routine }: { routine: RoutineListItem }) {
  return (
    <Link href={`/routines/${routine.id}`}>
      <div className="press border-hairline bg-surface-1 rounded-card border px-4 py-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[16px] font-semibold">{routine.name}</p>
          <span className="text-text-3 num flex shrink-0 items-center gap-2 text-[11px]">
            {routine.likeCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <Heart className="size-3" strokeWidth={2.4} />
                {routine.likeCount}
              </span>
            )}
            {!routine.isPublic && <span>Private</span>}
          </span>
        </div>
        <p className="text-text-3 num mt-0.5 text-[12px]">
          {routine.exerciseCount} exercise
          {routine.exerciseCount === 1 ? "" : "s"} · {routine.setCount} set
          {routine.setCount === 1 ? "" : "s"}
          {routine.sourceAuthor && <> · from @{routine.sourceAuthor}</>}
        </p>
        {routine.preview.length > 0 && (
          <p className="text-text-3 mt-1.5 truncate text-[13px]">
            {routine.preview.join(" · ")}
            {routine.exerciseCount > routine.preview.length && " …"}
          </p>
        )}
      </div>
    </Link>
  );
}
