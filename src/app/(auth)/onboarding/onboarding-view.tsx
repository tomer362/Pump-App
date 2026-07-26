"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Segmented } from "@/components/ui/primitives";
import { Wordmark } from "@/components/wordmark";
import { completeOnboarding } from "@/lib/actions/user";
import { cn } from "@/lib/utils";

const REST_PRESETS = [60, 90, 120, 180, 240];

export function OnboardingView({
  defaultName,
  suggestedUsername,
}: {
  defaultName: string;
  suggestedUsername: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(defaultName);
  const [username, setUsername] = useState(suggestedUsername);
  const [unit, setUnit] = useState<"kg" | "lb">("kg");
  const [rest, setRest] = useState(120);
  const [error, setError] = useState<string | null>(null);

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
    <main className="flex min-h-screen-d flex-col px-6 pt-safe pb-safe inset-safe-x">
      <div className="flex-1 pt-10">
        <Wordmark size={24} className="opacity-60" />
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
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
            </div>
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
            <div className="flex gap-2">
              {REST_PRESETS.map((s) => (
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
                  {s < 60 ? `${s}s` : `${s / 60}m`}
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
          disabled={pending || name.trim().length === 0 || username.length < 3}
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
