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
      <NavBar title="Exercises" back="/profile" />
      <ExerciseBrowser initial={initial} />
    </div>
  );
}
