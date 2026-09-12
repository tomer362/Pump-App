"use client";

import { useRouter } from "next/navigation";
import { Segmented } from "@/components/ui/primitives";
import { haptic } from "@/lib/utils";

const TABS = [
  { value: "mine" as const, label: "Mine" },
  { value: "discover" as const, label: "Discover" },
];

/**
 * A segmented control rather than a sixth tab. The tab bar is already five
 * items wide on a phone, and Discover is somewhere you arrive from your own
 * routines — not a destination you navigate to cold.
 */
export function RoutinesTabs({
  active,
  sort,
}: {
  active: "mine" | "discover";
  sort: string;
}) {
  const router = useRouter();

  return (
    <div className="mb-4">
      <Segmented
        value={active}
        options={TABS}
        onChange={(v) => {
          if (v === active) return;
          haptic.light();
          // Replace, like the sort control: pushing stacked a history entry
          // per toggle, so back walked the segmented control instead of
          // leaving the page.
          router.replace(
            v === "mine" ? "/routines" : `/routines?tab=discover&sort=${sort}`,
            { scroll: false },
          );
        }}
      />
    </div>
  );
}
