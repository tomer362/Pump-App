"use client";

import { Share2, Plus } from "lucide-react";

/**
 * The iPhone install, spelled out.
 *
 * Safari exposes no API for Add to Home Screen — `beforeinstallprompt` is a
 * Chromium extension nobody else implements — so this is the one place in the
 * app where the honest answer to "install it" is instructions rather than a
 * button. Shared by the sheet and the settings card so the two can't drift into
 * describing different gestures.
 */
export function InstallSteps() {
  return (
    <ol className="border-hairline space-y-3 rounded-[12px] border px-3 py-3">
      <Step n={1}>
        Tap <Share2 className="mx-0.5 inline size-4 align-text-bottom" />{" "}
        <span className="text-text-1">Share</span> in the Safari toolbar.
      </Step>
      <Step n={2}>
        Choose <Plus className="mx-0.5 inline size-4 align-text-bottom" />{" "}
        <span className="text-text-1">Add to Home Screen</span> — scroll the
        list if you don&apos;t see it.
      </Step>
      <Step n={3}>
        Tap <span className="text-text-1">Add</span>, then open Pump from its
        icon.
      </Step>
    </ol>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="bg-surface-2 text-text-2 num grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-semibold">
        {n}
      </span>
      <span className="text-text-3 text-[13px] leading-relaxed">{children}</span>
    </li>
  );
}
