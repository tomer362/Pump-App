import { notFound } from "next/navigation";
import { NavBar } from "@/components/ui/nav-bar";
import { CoopRoom } from "./coop-room";
import { requireUser } from "@/lib/session";
import { getCoopSnapshot } from "@/lib/actions/coop";

export default async function CoopSessionPage(
  props: PageProps<"/coop/[id]">,
) {
  const { id } = await props.params;
  const me = await requireUser();

  const snapshot = await getCoopSnapshot(id);
  if (!snapshot) notFound();
  // Only participants can see the room.
  if (!snapshot.participants.some((p) => p.userId === me.id)) notFound();

  return (
    <div className="pb-8">
      <NavBar title={snapshot.name} back="/start" large={false} />
      <CoopRoom
        initial={snapshot}
        currentUserId={me.id}
        unit={me.unit}
      />
    </div>
  );
}
