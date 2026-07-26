/**
 * Presentational primitives with no hooks or browser APIs, so they render in
 * both server and client components. Deliberately no "use client": marking
 * this file would make every page importing it pass icons and handlers across
 * the RSC boundary, which React rejects for function props.
 */

import * as React from "react";
import Image from "next/image";
import { cn, initialsOf } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Card — reserved for the social feed and summary blocks. The workout screen  */
/* deliberately uses rows + hairlines instead, so cards stay meaningful.       */
/* -------------------------------------------------------------------------- */

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface-1 border-hairline rounded-card border",
        className,
      )}
      {...props}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Grouped list — the iOS inset-list idiom.                                   */
/* -------------------------------------------------------------------------- */

export function List({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-surface-1 border-hairline rounded-card divide-hairline divide-y overflow-hidden border",
        className,
      )}
      {...props}
    />
  );
}

export function ListRow({
  className,
  leading,
  trailing,
  title,
  subtitle,
  onClick,
}: {
  className?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClick?: () => void;
}) {
  const inner = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-medium">{title}</div>
        {subtitle && (
          <div className="text-text-3 truncate text-[13px]">{subtitle}</div>
        )}
      </div>
      {trailing}
    </>
  );

  const base = "flex w-full items-center gap-3 px-4 py-3 text-left";

  return onClick ? (
    <button
      onClick={onClick}
      className={cn(base, "press active:bg-surface-2", className)}
    >
      {inner}
    </button>
  ) : (
    <div className={cn(base, className)}>{inner}</div>
  );
}

/* -------------------------------------------------------------------------- */
/* Inputs                                                                      */
/* -------------------------------------------------------------------------- */

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cn(
        "bg-surface-2 border-hairline rounded-field h-11 w-full border px-3",
        "text-text-1 placeholder:text-text-3 text-[16px]",
        "outline-none transition-colors focus:border-volt/60",
        className,
      )}
      {...props}
    />
  );
});

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "bg-surface-2 border-hairline rounded-field w-full border px-3 py-2.5",
        "text-text-1 placeholder:text-text-3 resize-none text-[16px]",
        "outline-none transition-colors focus:border-volt/60",
        className,
      )}
      {...props}
    />
  );
});

/** Segmented control — the iOS choice widget, far better than a select on touch. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cn(
        "bg-surface-2 flex gap-0.5 rounded-[10px] p-0.5",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "press h-8 flex-1 rounded-lg text-[13px] font-medium transition-colors",
              active
                ? "bg-surface-3 text-text-1 shadow-sm"
                : "text-text-3 hover:text-text-2",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar                                                                      */
/* -------------------------------------------------------------------------- */

const AVATAR_SIZES = { xs: 24, sm: 32, md: 40, lg: 56, xl: 88 } as const;

export function Avatar({
  src,
  name,
  size = "md",
  className,
  ring,
}: {
  src?: string | null;
  name?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
  /** Volt ring — used to mark "currently at the gym". */
  ring?: boolean;
}) {
  const px = AVATAR_SIZES[size];
  return (
    <span
      className={cn(
        "bg-surface-3 relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full",
        ring && "ring-volt ring-2 ring-offset-2 ring-offset-bg",
        className,
      )}
      style={{ width: px, height: px }}
    >
      {src ? (
        <Image
          src={src}
          alt={name ?? ""}
          width={px}
          height={px}
          className="size-full object-cover"
          unoptimized
        />
      ) : (
        <span
          className="font-display text-text-2 font-semibold"
          style={{ fontSize: px * 0.38 }}
        >
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat + badges                                                               */
/* -------------------------------------------------------------------------- */

export function Stat({
  label,
  value,
  unit,
  accent,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-text-3 text-[11px] font-medium tracking-[0.06em] uppercase">
        {label}
      </div>
      <div
        className={cn(
          "num mt-0.5 truncate text-[22px] leading-none font-bold",
          accent ? "text-volt" : "text-text-1",
        )}
      >
        {value}
        {unit && (
          <span className="text-text-3 ml-0.5 text-[13px] font-semibold">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "volt" | "pr" | "danger";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-[0.04em] uppercase",
        tone === "neutral" && "bg-surface-3 text-text-2",
        tone === "volt" && "bg-volt-fade text-volt",
        tone === "pr" && "bg-pr-fade text-pr",
        tone === "danger" && "bg-danger-fade text-danger",
        className,
      )}
    >
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty state                                                                 */
/* -------------------------------------------------------------------------- */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      <span className="bg-surface-1 border-hairline mb-4 grid size-14 place-items-center rounded-2xl border">
        <Icon className="text-text-3 size-6" strokeWidth={1.8} />
      </span>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      {body && (
        <p className="text-text-3 mt-1 max-w-[36ch] text-[14px] leading-relaxed">
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Screen-level section heading. */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-baseline justify-between", className)}>
      <h3 className="text-text-3 text-[11px] font-semibold tracking-[0.08em] uppercase">
        {children}
      </h3>
      {action}
    </div>
  );
}
