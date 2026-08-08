"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, FolderInput, Pencil, Percent, Play, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { LoadPickerSheet } from "@/components/workout/load-picker";
import { copyRoutine, deleteRoutine } from "@/lib/actions/routine";
import { startWorkoutFromRoutine } from "@/lib/actions/workout";
import type { FolderListItem } from "@/lib/queries/routine";
import { haptic } from "@/lib/utils";

// Behind a gesture, so it stays out of the initial payload.
const MoveToFolderSheet = dynamic(() =>
  import("@/components/routine/move-to-folder-sheet").then(
    (m) => m.MoveToFolderSheet,
  ),
);
const ShareRoutineSheet = dynamic(() =>
  import("@/components/routine/routine-transfer-sheets").then(
    (m) => m.ShareRoutineSheet,
  ),
);

export function RoutineActions({
  routineId,
  routineName,
  isOwner,
  isPublic,
  hasActiveWorkout,
  folders,
  currentFolderId,
}: {
  routineId: string;
  routineName: string;
  isOwner: boolean;
  isPublic: boolean;
  hasActiveWorkout: boolean;
  folders: FolderListItem[];
  currentFolderId: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loadSheet, setLoadSheet] = useState(false);
  const [shareSheet, setShareSheet] = useState(false);
  const [moveSheet, setMoveSheet] = useState(false);
  const [multiplier, setMultiplier] = useState(1);

  async function start(mult: number) {
    setBusy(true);
    setError(null);
    const res = await startWorkoutFromRoutine(routineId, mult);
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
        <div className="flex gap-2">
          <Button
            variant="volt"
            size="lg"
            block
            loading={busy}
            disabled={hasActiveWorkout}
            onClick={() => start(1)}
          >
            <Play className="size-4" fill="currentColor" />
            {hasActiveWorkout
              ? "Finish your current workout first"
              : "Start routine"}
          </Button>
          {!hasActiveWorkout && (
            <button
              onClick={() => {
                haptic.light();
                setLoadSheet(true);
              }}
              aria-label="Start at a different load"
              className="press tap bg-surface-2 text-text-2 grid shrink-0 place-items-center rounded-field px-3.5"
            >
              <Percent className="size-[18px]" strokeWidth={2.4} />
            </button>
          )}
        </div>

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
              <Button
                block
                variant="solid"
                onClick={() => {
                  haptic.light();
                  setMoveSheet(true);
                }}
              >
                <FolderInput className="size-4" />
                Move
              </Button>
              {/* Always offered now. The link half is still gated on the
                  routine being reachable — a link to a private routine 404s
                  for everyone who receives it — but a file is not a link, and
                  a private routine is yours to take away. */}
              <Button
                block
                variant="solid"
                onClick={() => {
                  haptic.light();
                  setShareSheet(true);
                }}
              >
                <Share2 className="size-4" />
                Share
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
              <Button
                block
                variant="solid"
                onClick={() => {
                  haptic.light();
                  setShareSheet(true);
                }}
              >
                <Share2 className="size-4" />
                Share
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

      <ShareRoutineSheet
        open={shareSheet}
        onClose={() => setShareSheet(false)}
        routineId={routineId}
        routineName={routineName}
        // A non-owner is looking at a routine that is public by definition —
        // that is the only way they could have opened it.
        linkWorks={!isOwner || isPublic}
        onShareLink={share}
        linkCopied={copied}
      />

      <MoveToFolderSheet
        open={moveSheet}
        onClose={() => setMoveSheet(false)}
        routineId={routineId}
        routineName={routineName}
        currentFolderId={currentFolderId}
        folders={folders}
      />

      <LoadPickerSheet
        open={loadSheet}
        onClose={() => setLoadSheet(false)}
        routineName={routineName}
        value={multiplier}
        onChange={setMultiplier}
        loading={busy}
        onConfirm={() => start(multiplier)}
      />

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
