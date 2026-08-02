"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adoptImportedExercise } from "@/lib/actions/exercise";

/**
 * The permanent way out of the hidden-by-default scope, on the one screen that
 * always resolves for an imported exercise.
 *
 * The picker's inline reveal is per-search by design; this is the setting. It
 * exists so nobody has to work out why an exercise they own and have used
 * won't come up when they search for it — the strip says what the state is and
 * offers the single tap that ends it.
 */
export function AdoptImported({ exerciseId }: { exerciseId: string }) {
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
      <Button
        block
        variant="solid"
        className="mt-3"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await adoptImportedExercise(exerciseId);
          setBusy(false);
          if (res.ok) router.refresh();
          else setError(res.error);
        }}
      >
        Add to my library
      </Button>
      {error && <p className="text-danger mt-2 text-[13px]">{error}</p>}
    </div>
  );
}
