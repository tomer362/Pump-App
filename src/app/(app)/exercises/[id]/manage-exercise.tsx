"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import {
  ExerciseForm,
  type ExerciseFormValues,
} from "@/components/exercise/exercise-form";
import {
  archiveCustomExercise,
  restoreCustomExercise,
} from "@/lib/actions/exercise";

/**
 * Edit and archive, offered only for exercises you created — the seeded
 * library is shared and has no owner.
 *
 * Archive rather than delete: a real delete cascades to every set logged
 * against the exercise, which rewrites finished workouts and drops the records
 * built from them. The copy says so, because "delete" that silently keeps data
 * is as confusing as one that silently destroys it.
 */
export function ManageExercise({
  exerciseId,
  name,
  archived,
  initial,
}: {
  exerciseId: string;
  name: string;
  archived: boolean;
  initial: ExerciseFormValues;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleArchive() {
    setBusy(true);
    setError(null);
    const res = archived
      ? await restoreCustomExercise(exerciseId)
      : await archiveCustomExercise(exerciseId);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setConfirming(false);
    router.refresh();
  }

  return (
    <>
      <div className="space-y-2">
        <Button block variant="outline" onClick={() => setEditing(true)}>
          <Pencil className="size-4" />
          Edit exercise
        </Button>
        {archived ? (
          <Button block variant="ghost" loading={busy} onClick={toggleArchive}>
            <ArchiveRestore className="size-4" />
            Restore to your library
          </Button>
        ) : (
          <Button
            block
            variant="ghost"
            className="text-danger"
            onClick={() => setConfirming(true)}
          >
            <Archive className="size-4" />
            Archive exercise
          </Button>
        )}
        {error && !confirming && (
          <p className="text-danger text-[13px]">{error}</p>
        )}
      </div>

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title={`Edit ${name}`}
        maxHeight="92dvh"
      >
        <ExerciseForm
          exerciseId={exerciseId}
          initial={initial}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            router.refresh();
          }}
        />
      </Sheet>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Archive ${name}?`}
      >
        <div className="px-4 pb-5">
          <p className="text-text-2 text-[14px] leading-relaxed">
            It disappears from search and the exercise picker. Every set you
            logged against it, its records and its place in your history stay
            exactly as they are — and you can restore it from{" "}
            <span className="text-text-1 font-medium">
              Exercises → Archived
            </span>{" "}
            at any time.
          </p>
          {error && <p className="text-danger mt-3 text-[13px]">{error}</p>}
          <div className="mt-5 space-y-2">
            <Button block variant="danger" loading={busy} onClick={toggleArchive}>
              <Archive className="size-4" />
              Archive exercise
            </Button>
            <Button block variant="ghost" onClick={() => setConfirming(false)}>
              Keep it
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
