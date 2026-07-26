"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  Input,
  Segmented,
  Textarea,
} from "@/components/ui/primitives";
import { updateProfile } from "@/lib/actions/user";
import { cn, haptic } from "@/lib/utils";

const REST_PRESETS = [60, 90, 120, 180, 240];

export function SettingsForm({
  name: initialName,
  bio: initialBio,
  unit: initialUnit,
  defaultRestSeconds,
  email,
  username,
}: {
  name: string;
  bio: string | null;
  unit: "kg" | "lb";
  defaultRestSeconds: number;
  email: string;
  username: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio ?? "");
  const [unit, setUnit] = useState(initialUnit);
  const [rest, setRest] = useState(defaultRestSeconds);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await updateProfile({
        name,
        bio: bio.trim() || null,
        unit,
        defaultRestSeconds: rest,
      });
      if (res.ok) {
        haptic.success();
        setSaved(true);
        router.refresh();
        window.setTimeout(() => setSaved(false), 2000);
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-6 px-4">
      <div>
        <Label>Display name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
      </div>

      <div>
        <Label>Bio</Label>
        <Textarea
          rows={2}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A line about your training"
          maxLength={160}
        />
      </div>

      <div>
        <Label>Weight unit</Label>
        <Segmented
          value={unit}
          onChange={setUnit}
          options={[
            { value: "kg", label: "Kilograms" },
            { value: "lb", label: "Pounds" },
          ]}
        />
        <p className="text-text-3 mt-1.5 text-[12px]">
          Weights are stored in kilograms; this only changes how they&apos;re
          shown.
        </p>
      </div>

      <div>
        <Label>Default rest timer</Label>
        <div className="flex gap-2">
          {REST_PRESETS.map((s) => (
            <button
              key={s}
              onClick={() => setRest(s)}
              className={cn(
                "press num rounded-field h-11 flex-1 border text-[14px] font-semibold",
                rest === s
                  ? "border-volt bg-volt-fade text-volt"
                  : "border-hairline bg-surface-2 text-text-2",
              )}
            >
              {s < 60 ? `${s}s` : `${s / 60}m`}
            </button>
          ))}
        </div>
      </div>

      <Button
        block
        variant="volt"
        onClick={save}
        loading={pending}
        disabled={!name.trim()}
      >
        {saved ? (
          <>
            <Check className="size-4" strokeWidth={3} />
            Saved
          </>
        ) : (
          "Save changes"
        )}
      </Button>

      {error && <p className="text-danger text-center text-[13px]">{error}</p>}

      <div>
        <Label>Account</Label>
        <Card className="divide-hairline divide-y overflow-hidden">
          <Row label="Email" value={email} />
          <Row label="Username" value={username ? `@${username}` : "Not set"} />
          <Link
            href="/exercises"
            className="press flex items-center gap-3 px-4 py-3"
          >
            <span className="flex-1 text-[15px]">Custom exercises</span>
            <ChevronRight className="text-text-3 size-4" />
          </Link>
          <Link
            href="/notifications"
            className="press flex items-center gap-3 px-4 py-3"
          >
            <span className="flex-1 text-[15px]">Notifications</span>
            <ChevronRight className="text-text-3 size-4" />
          </Link>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-text-2 flex-1 text-[15px]">{label}</span>
      <span className="text-text-3 truncate text-[14px]">{value}</span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}
