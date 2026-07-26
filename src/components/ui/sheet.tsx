"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn, haptic } from "@/lib/utils";

/**
 * Bottom sheet with drag-to-dismiss, the dominant modal pattern on phones —
 * it keeps the dismiss gesture in the thumb zone instead of a corner X.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  /** Sheet grows to content by default; set to cap it and scroll inside. */
  maxHeight = "88dvh",
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
  footer?: React.ReactNode;
}) {
  const reduce = useReducedMotion();

  // Lock the page behind the sheet so scrolling the sheet doesn't chain.
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            className="absolute inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              "bg-surface-1 relative w-full max-w-lg overflow-hidden",
              "rounded-t-sheet border-hairline border-t",
              "flex flex-col",
            )}
            style={{ maxHeight }}
            initial={reduce ? { opacity: 0 } : { y: "100%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "100%" }}
            transition={
              reduce
                ? { duration: 0.15 }
                : { type: "spring", stiffness: 420, damping: 38, mass: 0.9 }
            }
            drag={reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              // Dismiss on a decisive flick or a past-halfway drag.
              if (info.offset.y > 120 || info.velocity.y > 600) {
                haptic.light();
                onClose();
              }
            }}
          >
            <div className="flex justify-center pt-2.5 pb-1">
              <span className="bg-surface-3 h-1 w-9 rounded-full" />
            </div>

            {title && (
              <div className="px-4 pt-1 pb-3">
                <h2 className="text-[17px] font-semibold">{title}</h2>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {children}
            </div>

            {footer ? (
              <div className="hairline-t bg-surface-1 px-4 pt-3 pb-3 mb-safe">
                {footer}
              </div>
            ) : (
              <div className="pb-safe" />
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
