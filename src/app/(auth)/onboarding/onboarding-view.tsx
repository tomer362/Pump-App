"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Segmented } from "@/components/ui/primitives";
import { Wordmark } from "@/components/wordmark";
import { checkUsernameAvailable, completeOnboarding } from "@/lib/actions/user";
import { cn } from "@/lib/utils";
import { REST_PRESETS, restLabel } from "@/lib/rest";
import { ENTER, REDUCED } from "@/lib/motion";
import { useMotionPreset } from "@/hooks/use-motion-preset";


/**
 * The canonical presets (`lib/rest.ts`), plus whatever is stored if it is
 * not among them — otherwise a 150 s default lit no chip and read as unset,
 * the same defect the routine builder's old hardcoded row had.
 */
function restChips(current: number) {
  return REST_PRESETS.includes(current as (typeof REST_PRESETS)[number])
    ? [...REST_PRESETS]
    : [...REST_PRESETS, current].sort((a, b) => a - b);
}

export function OnboardingView({
  defaultName,
  suggestedUsername,
}: {
  defaultName: string;
  suggestedUsername: string;
}) {
  const { enabled } = useMotionPreset();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [username, setUsername] = useState(suggestedUsername);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [rest, setRest] = useState(120);
  const [error, setError] = useState<string | null>(null);

  /**
   * Live availability rather than failing on submit. The verdict is stored
   * against the handle it was asked about, so a slow response for an old
   * value can never overwrite a newer one — and "checking" is derived from
   * the absence of a verdict for what's currently typed, rather than being
   * a second piece of state to keep in sync.
   */
  const [verdict, setVerdict] = useState<{
    handle: string;
    available: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (username.length < 3) return;
    let cancelled = false;
    const id = window.setTimeout(async () => {
      const res = await checkUsernameAvailable(username);
      if (cancelled) return;
      setVerdict(
        res.ok
          ? { handle: username, available: res.data?.available ?? false }
          : { handle: username, available: false, error: res.error },
      );
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [username]);

  const current = verdict?.handle === username ? verdict : null;
  const handleStatus =
    username.length < 3
      ? "idle"
      : !current
        ? "checking"
        : current.error
          ? "invalid"
          : current.available
            ? "free"
            : "taken";

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await completeOnboarding({
        name,
        username,
        unit,
        defaultRestSeconds: rest,
      });
      if (res.ok) router.replace("/feed");
      else setError(res.error);
    });
  }

  return (
    <main className="px-safe-6 flex min-h-screen-d flex-col pt-safe pb-safe">
      <div className="flex-1 pt-10">
        <Wordmark size={24} className="opacity-60" />
        <motion.h1
          initial={{ opacity: 0, y: enabled ? 10 : 0 }}
          animate={{ opacity: 1, y: 0 }}
          transition={enabled ? ENTER : REDUCED}
          className="font-display mt-6 text-[32px] leading-[1.05] font-extrabold tracking-[-0.03em]"
        >
          Set up your profile
        </motion.h1>
        <p className="text-text-3 mt-2 text-[14px]">
          You can change any of this later.
        </p>

        <div className="mt-8 space-y-6">
          <Field label="Display name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={60}
            />
          </Field>

          <Field
            label="Username"
            hint="How friends find you. Letters, numbers, dots, underscores."
          >
            <div className="relative">
              <span className="text-text-3 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[16px]">
                @
              </span>
              <Input
                value={username}
                onChange={(e) =>
                  setUsername(
                    e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ""),
                  )
                }
                className="pl-7"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={20}
              />
              {handleStatus === "checking" && (
                <Loader2 className="text-text-3 absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
              )}
              {handleStatus === "free" && (
                <Check
                  aria-label="Available"
                  className="text-volt absolute top-1/2 right-3 size-4 -translate-y-1/2"
                  strokeWidth={3}
                />
              )}
              {(handleStatus === "taken" || handleStatus === "invalid") && (
                <AlertCircle
                  aria-label="Unavailable"
                  className="text-danger absolute top-1/2 right-3 size-4 -translate-y-1/2"
                />
              )}
            </div>
            {handleStatus === "taken" && (
              <p className="text-danger mt-1.5 text-[12px]">
                @{username} is taken — try another.
              </p>
            )}
            {handleStatus === "invalid" && (
              <p className="text-danger mt-1.5 text-[12px]">{current?.error}</p>
            )}
          </Field>

          <Field label="Weight unit">
            <Segmented
              value={unit}
              onChange={setUnit}
              options={[
                { value: "kg", label: "Kilograms" },
                { value: "lb", label: "Pounds" },
              ]}
            />
          </Field>

          <Field label="Default rest between sets">
            <div className="grid grid-cols-4 gap-2">
              {restChips(rest).map((s) => (
                <button
                  key={s}
                  onClick={() => setRest(s)}
                  className={cn(
                    "press num h-11 flex-1 rounded-field border text-[15px] font-semibold transition-colors",
                    rest === s
                      ? "border-volt bg-volt-fade text-volt"
                      : "border-hairline bg-surface-2 text-text-2",
                  )}
                >
                  {restLabel(s)}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>

      <div className="pb-8">
        {error && (
          <p className="text-danger mb-3 text-center text-[13px]">{error}</p>
        )}
        <Button
          variant="volt"
          size="lg"
          block
          onClick={submit}
          disabled={
            pending ||
            name.trim().length === 0 ||
            username.length < 3 ||
            handleStatus === "taken" ||
            handleStatus === "invalid"
          }
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <Check className="size-4" strokeWidth={3} />
              Start lifting
            </>
          )}
        </Button>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-text-3 mb-2 block text-[11px] font-semibold tracking-[0.08em] uppercase">
        {label}
      </label>
      {children}
      {hint && <p className="text-text-3 mt-1.5 text-[12px]">{hint}</p>}
    </div>
  );
}
