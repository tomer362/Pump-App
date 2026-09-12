import { NavBar } from "@/components/ui/nav-bar";
import { CoopLauncher } from "./coop-launcher";
import { requireUser } from "@/lib/session";
import { getRoutines } from "@/lib/queries/routine";
import { db } from "@/lib/db";
import { coopParticipant, coopSession } from "@/lib/db/schema";
import { and, desc, eq, isNull } from "drizzle-orm";

export default async function CoopPage() {
  const me = await requireUser();
  const routines = await getRoutines(me.id);

  // Any session the user is already part of that hasn't ended.
  const [active] = await db
    .select({
      id: coopSession.id,
      name: coopSession.name,
      joinCode: coopSession.joinCode,
    })
    .from(coopSession)
    .innerJoin(
      coopParticipant,
      eq(coopParticipant.coopSessionId, coopSession.id),
    )
    .where(
      and(eq(coopParticipant.userId, me.id), isNull(coopSession.endedAt)),
    )
    .orderBy(desc(coopSession.startedAt))
    .limit(1);

  return (
    <div className="pb-8">
      <NavBar
        title="Co-op"
        back="/start"
        subtitle="Train together, track separately"
      />
      <div className="px-safe-4">
        <CoopLauncher
          routines={routines.map((r) => ({ id: r.id, name: r.name }))}
          activeSession={active ?? null}
        />
      </div>
    </div>
  );
}
