"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Wordmark } from "@/components/wordmark";
import { Button } from "@/components/ui/button";
import { signInWithGoogle } from "@/lib/auth-client";
import { GoogleMark } from "@/components/google-mark";
import { DUR, EASE_OUT_QUART, REDUCED } from "@/lib/motion";
import { useMotionPreset } from "@/hooks/use-motion-preset";

const LINES = [
  "Log every set in one tap.",
  "See what your friends are lifting.",
  "Never guess your last weight again.",
];

export function SignInView() {
  const { enabled } = useMotionPreset();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGoogle() {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle("/feed");
    } catch {
      setError("Couldn't reach Google. Check your connection and try again.");
      setLoading(false);
    }
  }

  return (
    <main className="px-safe-6 flex min-h-screen-d flex-col pt-safe pb-safe">
      {/* A single volt bloom behind the mark — the one decorative flourish in
          the whole app, and it earns its place by being the first screen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[55dvh] opacity-[0.16]"
        style={{
          background:
            "radial-gradient(90% 60% at 50% 8%, var(--color-volt) 0%, transparent 68%)",
        }}
      />

      <div className="relative flex flex-1 flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: enabled ? 12 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={
            enabled ? { duration: 0.5, ease: EASE_OUT_QUART } : REDUCED
          }
          className="flex flex-col items-center text-center"
        >
          <Wordmark size={52} />
          <h1 className="font-display mt-7 max-w-[12ch] text-[40px] leading-[0.98] font-extrabold tracking-[-0.035em]">
            Train hard.
            <br />
            <span className="text-volt">Together.</span>
          </h1>

          {/* The list is centred as a block but its rows stay left-aligned, so
              the volt dots line up instead of raggedly tracking each line's
              width. `items-center` on the parent shrinks it to its content. */}
          <ul className="mt-8 space-y-2.5 text-left">
            {LINES.map((line, i) => (
              <motion.li
                key={line}
                initial={{ opacity: 0, y: enabled ? 6 : 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  enabled
                    ? {
                        delay: 0.18 + i * 0.08,
                        duration: DUR.slow,
                        ease: EASE_OUT_QUART,
                      }
                    : REDUCED
                }
                className="text-text-2 flex items-center gap-2.5 text-[15px]"
              >
                <span className="bg-volt size-1.5 shrink-0 rounded-full" />
                {line}
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Sign-in lives in the thumb zone, not centred in the page. */}
      <motion.div
        initial={{ opacity: 0, y: enabled ? 16 : 0 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          enabled
            ? { delay: 0.34, duration: 0.45, ease: EASE_OUT_QUART }
            : REDUCED
        }
        className="relative pb-8"
      >
        {error && (
          <p className="text-danger mb-3 text-center text-[13px]">{error}</p>
        )}
        <Button
          variant="volt"
          size="lg"
          block
          loading={loading}
          onClick={onGoogle}
          className="gap-3"
        >
          {!loading && <GoogleMark className="size-[18px]" />}
          Continue with Google
        </Button>
        <p className="text-text-3 mt-4 text-center text-[12px] leading-relaxed">
          By continuing you agree that your workouts are visible to people you
          allow to follow you.
        </p>
      </motion.div>
    </main>
  );
}
