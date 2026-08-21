"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adoptImportedExercise } from "@/lib/actions/exercise";

/**
 * Why an exercise you own doesn't behave like the rest of the library.
 *
 * Two surfaces show these and they must not drift: the exercise page, and the
 * About sheet the routine builder opens instead of navigating. The builder is
 * where imported exercises are actually met — a routine that arrived as JSON is
 * full of them — so a sheet silent about the state was the screen most likely
 * to leave someone wondering why a movement they own won't come up in search.
 *
 * Archived says the same thing more strongly, so only one strip ever shows.
 */
export function ExerciseStateStrips({
  exerciseId,
  archived,
  imported,
  onAdopted,
}: {
  exerciseId: string;
  archived: boolean;
  /** Already narrowed to "mine, not archived" by the caller. */
  imported: boolean;
  /** For a surface with no server render behind it to refresh. */
  onAdopted?: () => void;
}) {
  if (archived) return <ArchivedStrip />;
  if (imported)
    return <AdoptImported exerciseId={exerciseId} onAdopted={onAdopted} />;
  return null;
}

function ArchivedStrip() {
  return (
    <div className="bg-surface-2 text-text-2 flex items-start gap-2.5 rounded-[var(--radius-card)] px-4 py-3 text-[13px] leading-relaxed">
      <Archive className="mt-0.5 size-4 shrink-0" />
      <p>
        Archived — hidden from search and the exercise picker. Everything below
        is still yours.
      </p>
    </div>
  );
}

/**
 * The permanent way out of the hidden-by-default scope, on the surfaces that
 * always resolve for an imported exercise.
 *
 * The picker's inline reveal is per-search by design; this is the setting. It
 * exists so nobody has to work out why an exercise they own and have used
 * won't come up when they search for it — the strip says what the state is and
 * offers the single tap that ends it.
 */
export function AdoptImported({
  exerciseId,
  onAdopted,
}: {
  exerciseId: string;
  onAdopted?: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="bg-surface-2 rounded-[var(--radius-card)] px-4 py-3">
      <div className="text-text-2 flex items-start gap-2.5 text-[13px] leading-relaxed">
        <PackageOpen className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="text-text-1 font-medium">
            Came with an imported routine.
          </span>{" "}
          It&apos;s yours — history and records log against it — but it stays
          out of exercise search until you add it.
        </p>
      </div>
      {/* outline, not solid: `solid` is bg-surface-2, which is this strip's own
          background — the button read as a line of centred text. */}
      <Button
        block
        variant="outline"
        className="mt-3"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await adoptImportedExercise(exerciseId);
          setBusy(false);
          if (res.ok) {
            // The page behind this re-renders from the server; a sheet opened
            // over unsaved React state has nothing to re-render, so it says so
            // itself. Both, because either surface may be the caller.
            onAdopted?.();
            router.refresh();
          } else setError(res.error);
        }}
      >
        Add to my library
      </Button>
      {error && <p className="text-danger mt-2 text-[13px]">{error}</p>}
    </div>
  );
}
