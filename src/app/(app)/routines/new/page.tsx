import { requireUser } from "@/lib/session";
import { getFolders } from "@/lib/queries/routine";
import { RoutineBuilder } from "@/components/routine/routine-builder";

export default async function NewRoutinePage() {
  const me = await requireUser();
  const folders = await getFolders(me.id);
  return (
    <RoutineBuilder
      unit={me.unit}
      defaultRestSeconds={me.defaultRestSeconds}
      folders={folders}
    />
  );
}
