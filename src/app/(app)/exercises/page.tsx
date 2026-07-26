import { NavBar } from "@/components/ui/nav-bar";
import { ExerciseBrowser } from "@/components/exercise/exercise-browser";
import { requireUser } from "@/lib/session";
import { searchExercises } from "@/lib/queries/exercise";

export default async function ExercisesPage() {
  const me = await requireUser();
  const initial = await searchExercises(me.id, {});
  return (
    <div className="pb-8">
      <NavBar title="Exercises" back="/profile" />
      <ExerciseBrowser initial={initial} />
    </div>
  );
}
