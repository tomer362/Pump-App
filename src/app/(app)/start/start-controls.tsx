"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startEmptyWorkout } from "@/lib/actions/workout";

export function StartControls({
  activeWorkoutId,
}: {
  activeWorkoutId: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (activeWorkoutId) {
    return (
      <Button
        variant="volt"
        size="lg"
        block
        onClick={() => router.push(`/workout/${activeWorkoutId}`)}
      >
        Resume workout
        <ArrowRight className="size-4" strokeWidth={2.6} />
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="volt"
        size="lg"
        block
        loading={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          const res = await startEmptyWorkout();
          if (res.ok && res.data) router.push(`/workout/${res.data.workoutId}`);
          else {
            setError(res.ok ? "Could not start" : res.error);
            setLoading(false);
          }
        }}
      >
        <Play className="size-4" fill="currentColor" />
        Start empty workout
      </Button>
      {error && <p className="text-danger mt-2 text-center text-[13px]">{error}</p>}
    </>
  );
}
