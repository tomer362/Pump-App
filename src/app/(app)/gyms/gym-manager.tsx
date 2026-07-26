"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Home, LogOut, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Card, Input } from "@/components/ui/primitives";
import {
  createGym,
  joinGymByCode,
  leaveGym,
  setHomeGym,
} from "@/lib/actions/social";
import { cn, haptic } from "@/lib/utils";

type Gym = {
  id: string;
  name: string;
  city: string | null;
  joinCode: string;
  memberCount: number;
};

export function GymManager({
  gyms,
  homeGymId,
}: {
  gyms: Gym[];
  homeGymId: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function submitCreate() {
    setBusy(true);
    setError(null);
    const res = await createGym({ name, city: city || null });
    setBusy(false);
    if (res.ok) {
      setMode(null);
      setName("");
      setCity("");
      router.refresh();
    } else setError(res.error);
  }

  async function submitJoin() {
    setBusy(true);
    setError(null);
    const res = await joinGymByCode(code);
    setBusy(false);
    if (res.ok) {
      setMode(null);
      setCode("");
      router.refresh();
    } else setError(res.error);
  }

  async function copy(joinCode: string) {
    haptic.light();
    try {
      await navigator.clipboard.writeText(joinCode);
      setCopied(joinCode);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button block variant="volt" onClick={() => setMode("create")}>
          <Plus className="size-4" strokeWidth={2.6} />
          Add gym
        </Button>
        <Button block variant="solid" onClick={() => setMode("join")}>
          Join with code
        </Button>
      </div>

      {gyms.length > 0 && (
        <Card className="divide-hairline mt-4 divide-y overflow-hidden">
          {gyms.map((g) => (
            <div key={g.id} className="px-4 py-3.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[15px] font-semibold">
                      {g.name}
                    </p>
                    {homeGymId === g.id && (
                      <span className="text-volt flex shrink-0 items-center gap-1 text-[11px] font-bold">
                        <Home className="size-3" strokeWidth={2.8} />
                        HOME
                      </span>
                    )}
                  </div>
                  <p className="text-text-3 flex items-center gap-1.5 text-[12px]">
                    {g.city && <>{g.city} · </>}
                    <Users className="size-3" />
                    {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-2">
                <button
                  onClick={() => copy(g.joinCode)}
                  className={cn(
                    "press num flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[13px] font-bold tracking-[0.1em]",
                    copied === g.joinCode
                      ? "bg-volt text-black"
                      : "bg-surface-2 text-text-1",
                  )}
                >
                  {copied === g.joinCode ? (
                    <Check className="size-3.5" strokeWidth={3} />
                  ) : (
                    <Copy className="size-3.5" strokeWidth={2.4} />
                  )}
                  {g.joinCode}
                </button>

                {homeGymId !== g.id && (
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        await setHomeGym(g.id);
                        router.refresh();
                      })
                    }
                    className="press text-text-3 px-2 py-1.5 text-[12px] font-semibold"
                  >
                    Make home
                  </button>
                )}

                <button
                  onClick={() =>
                    startTransition(async () => {
                      await leaveGym(g.id);
                      router.refresh();
                    })
                  }
                  aria-label={`Leave ${g.name}`}
                  className="press text-text-3 ml-auto p-1.5"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Sheet
        open={mode === "create"}
        onClose={() => setMode(null)}
        title="Add your gym"
        footer={
          <Button
            block
            variant="volt"
            loading={busy}
            disabled={!name.trim()}
            onClick={submitCreate}
          >
            Create gym
          </Button>
        }
      >
        <div className="space-y-4 px-4 pb-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gym name"
            maxLength={80}
            autoFocus
          />
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City (optional)"
            maxLength={80}
          />
          <p className="text-text-3 text-[12px] leading-relaxed">
            You&apos;ll get a join code to share. Anyone with the code can join
            and see check-ins.
          </p>
          {error && <p className="text-danger text-[13px]">{error}</p>}
        </div>
      </Sheet>

      <Sheet
        open={mode === "join"}
        onClose={() => setMode(null)}
        title="Join a gym"
        footer={
          <Button
            block
            variant="volt"
            loading={busy}
            disabled={code.trim().length < 4}
            onClick={submitJoin}
          >
            Join
          </Button>
        }
      >
        <div className="space-y-4 px-4 pb-4">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="num text-center text-[20px] font-bold tracking-[0.2em]"
            autoFocus
          />
          <p className="text-text-3 text-[12px] leading-relaxed">
            Ask someone who trains there for the code.
          </p>
          {error && <p className="text-danger text-[13px]">{error}</p>}
        </div>
      </Sheet>
    </>
  );
}
