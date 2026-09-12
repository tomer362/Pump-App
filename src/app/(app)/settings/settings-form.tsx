"use client";

import { useState, useTransition } from "react";
import { useTransient } from "@/hooks/use-transient";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  FieldLabel,
  Input,
  Segmented,
  Textarea,
} from "@/components/ui/primitives";
import { PhotoInput } from "@/components/ui/photo-input";
import { setAvatar, updateProfile } from "@/lib/actions/user";
import { cn, haptic } from "@/lib/utils";
import { REST_PRESETS, restLabel } from "@/lib/rest";


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

export function SettingsForm({
  name: initialName,
  bio: initialBio,
  unit: initialUnit,
  defaultRestSeconds,
  email,
  username,
  image: initialImage,
  uploadsEnabled,
}: {
  name: string;
  bio: string | null;
  unit: "kg" | "lb";
  defaultRestSeconds: number;
  email: string;
  username: string | null;
  image: string | null;
  /** False when the deployment has no Blob store — then no avatar control. */
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initialName);
  const [bio, setBio] = useState(initialBio ?? "");
  const [unit, setUnit] = useState(initialUnit);
  const [rest, setRest] = useState(defaultRestSeconds);
  const [image, setImage] = useState(initialImage);
  const [saved, flashSaved] = useTransient(false, 2000);
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
        flashSaved(true);
        router.refresh();
      } else setError(res.error);
    });
  }

  return (
    <div className="space-y-6 px-4">
      {uploadsEnabled && (
        <div>
          <FieldLabel>Photo</FieldLabel>
          <PhotoInput
            value={image}
            onChange={(url) => {
              // Saved immediately rather than with the rest of the form: the
              // upload already happened, and leaving the page would otherwise
              // orphan the blob.
              setImage(url);
              startTransition(async () => {
                const res = await setAvatar(url);
                if (!res.ok) setError(res.error);
                else router.refresh();
              });
            }}
            prefix="avatars"
            shape="circle"
            label="Upload a photo"
          />
        </div>
      )}

      <div>
        <FieldLabel>Display name</FieldLabel>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
      </div>

      <div>
        <FieldLabel>Bio</FieldLabel>
        <Textarea
          rows={2}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A line about your training"
          maxLength={160}
        />
      </div>

      <div>
        <FieldLabel>Weight unit</FieldLabel>
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
        <FieldLabel>Default rest timer</FieldLabel>
        <div className="grid grid-cols-4 gap-2">
          {restChips(rest).map((s) => (
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
              {restLabel(s)}
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
        <FieldLabel>Account</FieldLabel>
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

