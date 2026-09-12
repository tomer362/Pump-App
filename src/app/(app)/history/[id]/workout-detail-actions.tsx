"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ListPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { saveWorkoutAsRoutine } from "@/lib/actions/routine";
import { deleteWorkout } from "@/lib/actions/workout";
import { watchAction } from "@/components/ui/toast";

export function WorkoutDetailActions({
  workoutId,
  workoutName,
}: {
  workoutId: string;
  workoutName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="flex gap-2">
        <Button
          block
          variant="solid"
          loading={busy}
          onClick={async () => {
            setBusy(true);
            setError(null);
            const res = await saveWorkoutAsRoutine(workoutId);
            setBusy(false);
            if (res.ok && res.data) {
              router.push(`/routines/${res.data.routineId}`);
              router.refresh();
            } else if (!res.ok) setError(res.error);
          }}
        >
          <ListPlus className="size-4" />
          Save as routine
        </Button>
        <Button
          variant="ghost"
          className="text-danger"
          onClick={() => setConfirmDelete(true)}
          aria-label="Delete workout"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      {error && <p className="text-danger mt-2 text-[13px]">{error}</p>}

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${workoutName}?`}
      >
        <div className="px-4 pb-5">
          <p className="text-text-2 text-[14px] leading-relaxed">
            The session, its sets and its feed post are removed. Records set in
            it are recalculated from what remains.
          </p>
          <div className="mt-5 space-y-2">
            <Button
              block
              variant="danger"
              loading={deleting}
              onClick={async () => {
                // A refused delete used to look exactly like a successful one:
                // straight to /history either way.
                setDeleting(true);
                const res = await watchAction(deleteWorkout(workoutId));
                if (!res.ok) {
                  setDeleting(false);
                  return;
                }
                router.replace("/history");
                router.refresh();
              }}
            >
              <Trash2 className="size-4" />
              Delete workout
            </Button>
            <Button block variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
