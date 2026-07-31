import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getFolders, getFullRoutine } from "@/lib/queries/routine";
import { RoutineBuilder } from "@/components/routine/routine-builder";

export default async function EditRoutinePage(
  props: PageProps<"/routines/[id]/edit">,
) {
  const { id } = await props.params;
  const me = await requireUser();
  const routine = await getFullRoutine(id, me.id);
  if (!routine || routine.userId !== me.id) notFound();

  const folders = await getFolders(me.id);

  return (
    <RoutineBuilder
      existing={routine}
      unit={me.unit}
      defaultRestSeconds={me.defaultRestSeconds}
      folders={folders}
    />
  );
}
