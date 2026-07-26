"use client";

import * as React from "react";
import { cn, haptic } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type Variant = "volt" | "solid" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // The accent is loud on purpose and therefore rare — one per screen, max.
  volt: "bg-volt text-black font-semibold hover:bg-volt/90 active:bg-volt-dim",
  solid: "bg-surface-2 text-text-1 hover:bg-surface-3 active:bg-surface-3",
  ghost: "bg-transparent text-text-2 hover:text-text-1 hover:bg-surface-1",
  outline:
    "bg-transparent text-text-1 border border-hairline-strong hover:bg-surface-1",
  danger: "bg-danger-fade text-danger hover:bg-danger/20",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-[13px] gap-1.5 rounded-[10px]",
  md: "h-11 px-4 text-[15px] gap-2 rounded-field",
  lg: "h-13 px-5 text-[17px] gap-2 rounded-field",
};

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Stretch to the container — the default for bottom-docked actions. */
  block?: boolean;
  /** Fire a light haptic on press (Android only; silently no-ops on iOS). */
  buzz?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "solid",
      size = "md",
      loading,
      block,
      buzz = true,
      disabled,
      children,
      onClick,
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        onClick={(e) => {
          if (buzz) haptic.light();
          onClick?.(e);
        }}
        className={cn(
          "press tap inline-flex items-center justify-center whitespace-nowrap",
          "outline-none focus-visible:ring-2 focus-visible:ring-volt/60",
          "disabled:opacity-40 disabled:pointer-events-none",
          VARIANTS[variant],
          SIZES[size],
          block && "w-full",
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 className="size-4 animate-spin" /> : children}
      </button>
    );
  },
);

/** Square icon-only button — used in nav bars and set rows. */
export const IconButton = React.forwardRef<
  HTMLButtonElement,
  ButtonProps & { label: string }
>(function IconButton({ className, label, size = "md", ...props }, ref) {
  return (
    <Button
      ref={ref}
      aria-label={label}
      variant="ghost"
      size={size}
      className={cn("aspect-square px-0", className)}
      {...props}
    />
  );
});
