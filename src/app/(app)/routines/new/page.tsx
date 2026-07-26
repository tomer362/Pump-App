import { requireUser } from "@/lib/session";
import { RoutineBuilder } from "@/components/routine/routine-builder";

export default async function NewRoutinePage() {
  const me = await requireUser();
  return (
    <RoutineBuilder unit={me.unit} defaultRestSeconds={me.defaultRestSeconds} />
  );
}
