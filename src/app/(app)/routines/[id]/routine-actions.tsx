"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Play, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { copyRoutine, deleteRoutine } from "@/lib/actions/routine";
import { startWorkoutFromRoutine } from "@/lib/actions/workout";
import { haptic } from "@/lib/utils";

export function RoutineActions({
  routineId,
  routineName,
  isOwner,
  hasActiveWorkout,
}: {
  routineId: string;
  routineName: string;
  isOwner: boolean;
  hasActiveWorkout: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await startWorkoutFromRoutine(routineId, 1);
    if (res.ok && res.data) router.push(`/workout/${res.data.workoutId}`);
    else {
      setError(res.ok ? "Could not start" : res.error);
      setBusy(false);
    }
  }

  async function share() {
    const url = `${window.location.origin}/routines/${routineId}`;
    haptic.light();
    // Native share sheet where available; clipboard is the universal fallback.
    if (navigator.share) {
      try {
        await navigator.share({ title: routineName, url });
        return;
      } catch {
        /* User dismissed the sheet — fall through to copying. */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy the link");
    }
  }

  return (
    <>
      <div className="space-y-2">
        <Button
          variant="volt"
          size="lg"
          block
          loading={busy}
          disabled={hasActiveWorkout}
          onClick={start}
        >
          <Play className="size-4" fill="currentColor" />
          {hasActiveWorkout ? "Finish your current workout first" : "Start routine"}
        </Button>

        <div className="flex gap-2">
          {isOwner ? (
            <>
              <Button
                block
                variant="solid"
                onClick={() => router.push(`/routines/${routineId}/edit`)}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
              <Button block variant="solid" onClick={share}>
                <Share2 className="size-4" />
                {copied ? "Link copied" : "Share"}
              </Button>
            </>
          ) : (
            <>
              <Button
                block
                variant="solid"
                loading={busy}
                onClick={async () => {
                  setBusy(true);
                  const res = await copyRoutine(routineId);
                  setBusy(false);
                  if (res.ok && res.data) {
                    router.push(`/routines/${res.data.routineId}`);
                    router.refresh();
                  } else if (!res.ok) setError(res.error);
                }}
              >
                <Copy className="size-4" />
                Save to my routines
              </Button>
              <Button block variant="solid" onClick={share}>
                <Share2 className="size-4" />
                {copied ? "Copied" : "Share"}
              </Button>
            </>
          )}
        </div>

        {isOwner && (
          <Button
            block
            variant="ghost"
            className="text-danger"
            onClick={() => setConfirmDelete(true)}
          >
            Delete routine
          </Button>
        )}
      </div>

      {error && <p className="text-danger mt-2 text-center text-[13px]">{error}</p>}

      <Sheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${routineName}?`}
      >
        <div className="px-4 pb-5">
          <p className="text-text-2 text-[14px] leading-relaxed">
            The routine is removed from your list. Workouts you already logged
            from it are kept.
          </p>
          <div className="mt-5 space-y-2">
            <Button
              block
              variant="danger"
              onClick={async () => {
                await deleteRoutine(routineId);
                router.replace("/routines");
                router.refresh();
              }}
            >
              <Trash2 className="size-4" />
              Delete routine
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
