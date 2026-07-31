import { cn } from "@/lib/utils";

/** The Pump wordmark. Plain text — legible at both nav-bar and hero scale. */
export function Wordmark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn(
        "font-display inline-flex items-center font-extrabold tracking-[-0.045em] select-none",
        className,
      )}
      style={{ fontSize: size, lineHeight: 1 }}
    >
      PUMP
    </span>
  );
}
