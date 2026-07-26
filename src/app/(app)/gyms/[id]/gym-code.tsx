"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { haptic } from "@/lib/utils";

/** Tap-to-copy join code. The code is a gym's only credential, so make
    handing it to someone one gesture rather than a manual transcription. */
export function GymCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      onClick={async () => {
        haptic.light();
        try {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-label={`Copy join code ${code}`}
      className="press num mt-0.5 flex items-center gap-2 text-[24px] font-bold tracking-[0.18em]"
    >
      {code}
      {copied ? (
        <Check className="text-volt size-4" strokeWidth={3} />
      ) : (
        <Copy className="text-text-3 size-4" />
      )}
    </button>
  );
}
