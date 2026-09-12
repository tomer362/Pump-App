"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, X } from "lucide-react";
import { uploadImage } from "@/lib/upload-image";
import { cn, haptic } from "@/lib/utils";

/**
 * Pick a photo, downscale it, upload it, hand back the URL.
 *
 * `capture` is deliberately absent: on iOS it forces the camera and removes
 * the library, and a gym photo is as often chosen after the fact as taken in
 * the moment.
 */
export function PhotoInput({
  value,
  onChange,
  prefix,
  shape = "rect",
  label = "Add a photo",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Blob pathname prefix, e.g. "avatars" or "workouts". */
  prefix: string;
  shape?: "rect" | "circle";
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadImage(file, { prefix }));
      haptic.light();
    } catch (err) {
      setError(
        (err as Error).message.includes("not configured")
          ? "Photo uploads aren't set up on this deployment"
          : "That upload failed — try again",
      );
    } finally {
      setBusy(false);
      // Allow re-picking the same file after a failure.
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          aria-label={value ? "Replace photo" : label}
          className={cn(
            "press border-hairline bg-surface-2 text-text-3 relative grid shrink-0 place-items-center overflow-hidden border",
            shape === "circle"
              ? "size-20 rounded-full"
              : "h-20 w-28 rounded-field",
          )}
        >
          {value && (
            <Image
              src={value}
              alt=""
              fill
              sizes="112px"
              className="object-cover"
            />
          )}
          {busy ? (
            <Loader2 className="relative size-5 animate-spin" />
          ) : (
            !value && <Camera className="size-5" strokeWidth={2.2} />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="press text-volt tap inline-flex items-center text-[14px] font-semibold disabled:opacity-50"
          >
            {value ? "Replace" : label}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => {
                haptic.light();
                onChange(null);
              }}
              className="press text-text-3 tap ml-3 inline-flex items-center gap-1 text-[13px]"
            >
              <X className="size-3.5" />
              Remove
            </button>
          )}
          {error && <p className="text-danger mt-1 text-[12px]">{error}</p>}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => pick(e.target.files?.[0])}
      />
    </div>
  );
}
