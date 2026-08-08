import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { ExerciseBrowser } from "@/components/exercise/exercise-browser";
import { requireUser } from "@/lib/session";
import { getRecentExercises, searchExercisePage } from "@/lib/queries/exercise";

export default async function ExercisesPage() {
  const me = await requireUser();
  // Only the first batch is server-rendered; the browser fetches the rest as
  // the user scrolls, so this page doesn't wait on the whole library.
  const [page, recent] = await Promise.all([
    searchExercisePage(me.id),
    getRecentExercises(me.id),
  ]);
  const initial = { ...page, recent };
  return (
    <div className="pb-8">
      {/* A tab root, so no back arrow. Whole-body stats live one tap away
          rather than in a tab of their own. */}
      <NavBar
        title="Exercises"
        right={
          <Link
            href="/stats"
            aria-label="Stats"
            className="press tap text-text-2 grid place-items-center px-2"
          >
            <BarChart3 className="size-[22px]" strokeWidth={2.2} />
          </Link>
        }
      />
      <ExerciseBrowser initial={initial} unit={me.unit} />
    </div>
  );
}
