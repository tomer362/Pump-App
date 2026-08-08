import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { NavBar } from "@/components/ui/nav-bar";
import { EmptyState } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { HistoryList } from "./history-list";
import { requireUser } from "@/lib/session";
import { getWorkoutHistory } from "@/lib/queries/workout";
import { HISTORY_PAGE_SIZE } from "@/lib/pagination";

export default async function HistoryPage() {
  const me = await requireUser();
  const workouts = await getWorkoutHistory(me.id, { limit: HISTORY_PAGE_SIZE });

  return (
    <div className="pb-8">
      {/* Reached from both Stats and Profile, so it goes back where you came
          from rather than to one hard-coded parent. */}
      <NavBar title="History" back />

      {workouts.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No workouts logged"
          body="Every session you finish is saved here with its sets, volume and records."
          action={
            <Link href="/start">
              <Button variant="volt">Start a workout</Button>
            </Link>
          }
        />
      ) : (
        <HistoryList initial={workouts} unit={me.unit} />
      )}
    </div>
  );
}
