"use client";

import { RotateCcw, WifiOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

/**
 * The screen a user actually sees when something throws.
 *
 * Without a boundary Next falls back to a bare white "Application error" page
 * — no theme, no navigation, and in an installed PWA no browser chrome either,
 * so the only way out is force-quitting the app. This keeps failures inside
 * the shell and always offers a way forward.
 */
export function ErrorScreen({
  reset,
  title = "Something went wrong",
  body = "That didn't load. It's usually temporary — the database sleeps when idle and can take a moment to wake.",
  digest,
}: {
  reset?: () => void;
  title?: string;
  body?: string;
  digest?: string;
}) {
  return (
    <main className="flex min-h-screen-d flex-col items-center justify-center px-8 pt-safe pb-safe">
      <Wordmark size={22} className="mb-10 opacity-40" />

      <span className="bg-surface-1 border-hairline mb-5 grid size-14 place-items-center rounded-2xl border">
        <WifiOff className="text-text-3 size-6" strokeWidth={1.8} />
      </span>

      <h1 className="font-display text-center text-[24px] leading-tight font-bold tracking-[-0.02em]">
        {title}
      </h1>
      <p className="text-text-3 mt-2 max-w-[38ch] text-center text-[14px] leading-relaxed">
        {body}
      </p>

      <div className="mt-8 w-full max-w-xs space-y-2">
        {reset && (
          <Button variant="volt" size="lg" block onClick={reset}>
            <RotateCcw className="size-4" strokeWidth={2.4} />
            Try again
          </Button>
        )}
        <Link href="/feed" className="block">
          <Button variant="ghost" size="lg" block>
            Back to the feed
          </Button>
        </Link>
      </div>

      {digest && (
        <p className="text-text-3/60 num mt-8 text-[11px]">Ref {digest}</p>
      )}
    </main>
  );
}
