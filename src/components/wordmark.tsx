import { cn } from "@/lib/utils";

/**
 * The Pump wordmark. The bar-and-plate glyph replaces the "U" — it reads as a
 * logo at 20px and as a graphic at 200px, and needs no image asset.
 */
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
      <span>P</span>
      <BarbellGlyph size={size} />
      <span>MP</span>
    </span>
  );
}

function BarbellGlyph({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      style={{
        width: size * 0.86,
        height: size,
        marginLeft: size * -0.02,
        marginRight: size * -0.02,
      }}
      className="text-volt inline-block"
      fill="none"
    >
      {/* Inner plates */}
      <rect x="6.5" y="6" width="3.2" height="12" rx="1.2" fill="currentColor" />
      <rect x="14.3" y="6" width="3.2" height="12" rx="1.2" fill="currentColor" />
      {/* Outer plates */}
      <rect x="3" y="8.5" width="2.4" height="7" rx="1" fill="currentColor" opacity="0.55" />
      <rect x="18.6" y="8.5" width="2.4" height="7" rx="1" fill="currentColor" opacity="0.55" />
      {/* Bar */}
      <rect x="9.4" y="10.9" width="5.4" height="2.2" rx="1.1" fill="currentColor" />
    </svg>
  );
}
