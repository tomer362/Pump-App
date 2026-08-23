"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dumbbell, Home, ListChecks, User, LibraryBig } from "lucide-react";
import { useLinkPending } from "./route-progress";
import { cn, haptic } from "@/lib/utils";
import { markRestoringNavigation } from "@/lib/scroll-memory";
import { scrollAppToTop } from "./scroll-restoration";

const TABS = [
  { href: "/feed", label: "Feed", icon: Home },
  { href: "/routines", label: "Routines", icon: ListChecks },
  { href: "/start", label: "Start", icon: Dumbbell, primary: true },
  // Exercises, not Stats. The library is where a lifter actually goes between
  // sessions — to check what they lifted last time, or to log one set — while
  // /stats was a hallway whose bottom two rows linked here and to /history.
  // Stats keeps its own route, reached from this tab's nav bar.
  { href: "/exercises", label: "Exercises", icon: LibraryBig },
  { href: "/profile", label: "You", icon: User },
] as const;

export function TabBar({ unreadCount = 0 }: { unreadCount?: number }) {
  const pathname = usePathname();

  return (
    <nav
      className="glass-dock hairline-t fixed inset-x-0 bottom-0 z-40 h-dock inset-safe-x"
      aria-label="Primary"
    >
      {/* The row pins to the top of the dock; what's left below it is the
          system inset, painted by the bar but kept clear of tap targets so a
          thumb never fights the home indicator. */}
      <ul className="mx-auto flex h-[var(--tab-row)] max-w-lg items-stretch">
        {TABS.map(({ href, label, icon: Icon, ...rest }) => {
          const primary = "primary" in rest && rest.primary;
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                onClick={() => {
                  haptic.light();
                  // Returning to a tab returns you to where you were reading
                  // it — the whole point of a tab bar over a menu. Tapping the
                  // tab you are already *on* is the one gesture that means the
                  // opposite: go back to the top.
                  if (pathname === href) scrollAppToTop();
                  else markRestoringNavigation("tab");
                }}
                aria-current={active ? "page" : undefined}
                className="press relative flex h-full flex-col items-center justify-center gap-[3px] text-[10px] font-medium tracking-[0.01em]"
              >
                {/* Unread marker lives on the profile tab, which is where the
                    inbox is reached from. A dot, not a number: the exact count
                    isn't actionable at this size. */}
                {href === "/profile" && unreadCount > 0 && (
                  <span
                    aria-label={`${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`}
                    className="bg-volt ring-bg absolute top-1.5 right-[calc(50%-16px)] size-2 rounded-full ring-2"
                  />
                )}
                <TabContent
                  active={active}
                  primary={!!primary}
                  Icon={Icon}
                  label={label}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * The tab's contents, split out so it can read `useLinkStatus` from inside the
 * `<Link>`. A tab that is being navigated to goes volt on the tap rather than
 * when the server answers — on a dynamic route that gap was the whole reason a
 * tab press felt ignored. It also feeds the route rail.
 */
function TabContent({
  active,
  primary,
  Icon,
  label,
}: {
  active: boolean;
  primary: boolean;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  label: string;
}) {
  const pending = useLinkPending();
  const lit = active || pending;

  return (
    <span
      className={cn(
        "flex flex-col items-center gap-[3px] transition-colors duration-150",
        lit ? "text-volt" : "text-text-3",
      )}
    >
      {primary ? (
        <span
          className={cn(
            "grid size-8 place-items-center rounded-[10px] transition-colors",
            lit ? "bg-volt text-black" : "bg-surface-2 text-text-1",
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2.4} />
        </span>
      ) : (
        <Icon className="size-[22px]" strokeWidth={lit ? 2.4 : 2} />
      )}
      <span className={primary ? "sr-only" : undefined}>{label}</span>
    </span>
  );
}

/**
 * Spacer so scrolling content clears the fixed tab bar + home indicator.
 *
 * `h-dock`, the same utility the bar itself uses, and no padding: this was
 * `h-[52px] pb-safe`, and under border-box an explicit height *absorbs* its own
 * padding — so the spacer was 52px while the bar was 52px + the inset, and
 * every page in the app hid the bottom of its last row behind the bar.
 */
export function TabBarSpacer() {
  return <div aria-hidden className="h-dock" />;
}
