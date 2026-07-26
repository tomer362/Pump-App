"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn, haptic } from "@/lib/utils";

/**
 * iOS-style navigation bar with a large title that collapses into the bar as
 * you scroll. Uses a sentinel + IntersectionObserver rather than a scroll
 * listener so it costs nothing on the main thread while scrolling.
 */
export function NavBar({
  title,
  back,
  right,
  large = true,
  subtitle,
}: {
  title: string;
  back?: boolean | string;
  right?: React.ReactNode;
  large?: boolean;
  subtitle?: string;
}) {
  const router = useRouter();
  const sentinel = React.useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = React.useState(!large);

  React.useEffect(() => {
    if (!large) return;
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-4px 0px 0px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [large]);

  const goBack = () => {
    haptic.light();
    if (typeof back === "string") router.push(back);
    else router.back();
  };

  return (
    <>
      <header
        className={cn(
          "sticky top-0 z-30 pt-safe inset-safe-x transition-[background-color,border-color] duration-200",
          collapsed ? "glass hairline-b" : "bg-bg border-b border-transparent",
        )}
      >
        <div className="relative flex h-11 items-center px-1">
          {back ? (
            <button
              onClick={goBack}
              aria-label="Back"
              className="press tap -ml-1 flex items-center pr-2 pl-1 text-volt"
            >
              <ChevronLeft className="size-6" strokeWidth={2.4} />
            </button>
          ) : (
            <span className="w-2" />
          )}

          <h1
            className={cn(
              "pointer-events-none absolute inset-x-0 mx-auto max-w-[60%] truncate text-center",
              "text-[17px] font-semibold transition-all duration-200",
              collapsed
                ? "translate-y-0 opacity-100"
                : "translate-y-1 opacity-0",
            )}
          >
            {title}
          </h1>

          <div className="ml-auto flex items-center gap-1">{right}</div>
        </div>
      </header>

      {large && (
        <div className="px-4 pt-1 pb-2 inset-safe-x">
          <h2 className="font-display text-[34px] leading-[1.1] font-bold tracking-[-0.03em]">
            {title}
          </h2>
          {subtitle && (
            <p className="text-text-3 mt-0.5 text-[13px]">{subtitle}</p>
          )}
          <div ref={sentinel} aria-hidden className="h-px" />
        </div>
      )}
    </>
  );
}
