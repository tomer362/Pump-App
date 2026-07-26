"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { deleteCustomExercise } from "@/lib/actions/routine";

/**
 * Only offered for exercises you created — the seeded library is shared and
 * has no owner to delete it.
 */
export function DeleteExercise({
  exerciseId,
  name,
}: {
  exerciseId: string;
  name: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <Button
        block
        variant="ghost"
        className="text-danger"
        onClick={() => setOpen(true)}
      >
        Delete exercise
      </Button>

      <Sheet open={open} onClose={() => setOpen(false)} title={`Delete ${name}?`}>
        <div className="px-4 pb-5">
          <p className="text-text-2 text-[14px] leading-relaxed">
            Sets you already logged against it are deleted too, along with any
            records it holds. Routines that use it lose the exercise. This
            can&apos;t be undone.
          </p>
          {error && <p className="text-danger mt-3 text-[13px]">{error}</p>}
          <div className="mt-5 space-y-2">
            <Button
              block
              variant="danger"
              loading={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const res = await deleteCustomExercise(exerciseId);
                if (!res.ok) {
                  setBusy(false);
                  setError(res.error);
                  return;
                }
                router.replace("/exercises");
                router.refresh();
              }}
            >
              <Trash2 className="size-4" />
              Delete exercise
            </Button>
            <Button block variant="ghost" onClick={() => setOpen(false)}>
              Keep it
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
