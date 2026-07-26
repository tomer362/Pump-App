"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Home, ListChecks, User, BarChart3 } from "lucide-react";
import { cn, haptic } from "@/lib/utils";

const TABS = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/routines", label: "Routines", icon: ListChecks },
  { href: "/start", label: "Start", icon: Dumbbell, primary: true },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/profile", label: "You", icon: User },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="glass hairline-t fixed inset-x-0 bottom-0 z-40 pb-safe inset-safe-x"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map(({ href, label, icon: Icon, ...rest }) => {
          const primary = "primary" in rest && rest.primary;
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                onClick={() => haptic.light()}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press flex h-[52px] flex-col items-center justify-center gap-[3px]",
                  "text-[10px] font-medium tracking-[0.01em]",
                  active ? "text-volt" : "text-text-3",
                )}
              >
                {primary ? (
                  <span
                    className={cn(
                      "grid size-8 place-items-center rounded-[10px] transition-colors",
                      active
                        ? "bg-volt text-black"
                        : "bg-surface-2 text-text-1",
                    )}
                  >
                    <Icon className="size-[18px]" strokeWidth={2.4} />
                  </span>
                ) : (
                  <Icon
                    className="size-[22px]"
                    strokeWidth={active ? 2.4 : 2}
                  />
                )}
                <span className={primary ? "sr-only" : undefined}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Spacer so scrolling content clears the fixed tab bar + home indicator. */
export function TabBarSpacer() {
  return <div aria-hidden className="h-[52px] pb-safe" />;
}
