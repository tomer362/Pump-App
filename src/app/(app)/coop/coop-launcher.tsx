"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Card, Input } from "@/components/ui/primitives";
import { LoadGrid } from "@/components/workout/load-picker";
import { createCoopSession, joinCoopSession } from "@/lib/actions/coop";
import { cn } from "@/lib/utils";

export function CoopLauncher({
  routines,
  activeSession,
}: {
  routines: { id: string; name: string }[];
  activeSession: { id: string; name: string; joinCode: string } | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // One error slot serves both sheets, so switching clears it — a refusal
  // from Create used to sit on screen inside Join.
  const openMode = (next: "create" | "join" | null) => {
    setError(null);
    setBusy(false);
    setMode(next);
  };

  if (activeSession) {
    return (
      <Card className="px-4 py-4">
        <p className="text-text-3 text-[11px] font-semibold tracking-[0.08em] uppercase">
          In progress
        </p>
        <p className="mt-1 text-[18px] font-semibold">{activeSession.name}</p>
        <p className="text-text-3 num mt-0.5 text-[13px] tracking-[0.15em]">
          {activeSession.joinCode}
        </p>
        <Button
          block
          variant="volt"
          className="mt-4"
          onClick={() => router.push(`/coop/${activeSession.id}`)}
        >
          Open session
          <ArrowRight className="size-4" strokeWidth={2.6} />
        </Button>
      </Card>
    );
  }

  return (
    <>
      <Card className="px-4 py-5">
        <span className="bg-surface-2 text-volt mb-3 grid size-11 place-items-center rounded-full">
          <Users className="size-5" strokeWidth={2.2} />
        </span>
        <p className="text-[17px] font-semibold">Train with a friend</p>
        <p className="text-text-2 mt-1 text-[14px] leading-relaxed">
          Everyone logs their own sets and keeps their own records — you just
          see each other&apos;s progress and rest timers as you go.
        </p>
        <div className="mt-4 flex gap-2">
          <Button block variant="volt" onClick={() => openMode("create")}>
            Start a session
          </Button>
          <Button block variant="solid" onClick={() => openMode("join")}>
            Join
          </Button>
        </div>
      </Card>

      <Sheet
        open={mode === "create"}
        onClose={() => openMode(null)}
        initialFocus="input"
        title="Start a co-op session"
        footer={
          <Button
            block
            variant="volt"
            loading={busy}
            disabled={!name.trim()}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await createCoopSession({
                name,
                routineId,
                loadMultiplier: multiplier,
              });
              setBusy(false);
              if (res.ok && res.data) {
                router.push(`/coop/${res.data.coopSessionId}`);
                router.refresh();
              } else if (!res.ok) setError(res.error);
            }}
          >
            Create session
          </Button>
        }
      >
        <div className="space-y-5 px-4 pb-4">
          <div>
            <Label>Session name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Saturday legs"
              maxLength={60}
            />
          </div>

          <div>
            <Label>Routine (optional)</Label>
            <p className="text-text-3 mb-2 text-[12px]">
              Everyone who joins gets their own copy of it.
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                label="None"
                active={routineId === null}
                onClick={() => setRoutineId(null)}
              />
              {routines.map((r) => (
                <Chip
                  key={r.id}
                  label={r.name}
                  active={routineId === r.id}
                  onClick={() => setRoutineId(r.id)}
                />
              ))}
            </div>
          </div>

          {/* Only meaningful with a routine — there are no prescribed weights
              to scale in an empty session. */}
          {routineId && (
            <div>
              <Label>Load</Label>
              <p className="text-text-3 mb-2 text-[12px]">
                Applies to everyone who joins, so a deload week means the same
                thing for the whole room.
              </p>
              <LoadGrid value={multiplier} onChange={setMultiplier} />
            </div>
          )}

          {error && <p className="text-danger text-[13px]">{error}</p>}
        </div>
      </Sheet>

      <Sheet
        open={mode === "join"}
        onClose={() => openMode(null)}
        initialFocus="input"
        title="Join a session"
        footer={
          <Button
            block
            variant="volt"
            loading={busy}
            disabled={code.trim().length < 4}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const res = await joinCoopSession(code);
              setBusy(false);
              if (res.ok && res.data) {
                router.push(`/coop/${res.data.coopSessionId}`);
                router.refresh();
              } else if (!res.ok) setError(res.error);
            }}
          >
            Join session
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
          />
          {error && <p className="text-danger text-[13px]">{error}</p>}
        </div>
      </Sheet>
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-text-3 mb-2 text-[11px] font-semibold tracking-[0.08em] uppercase">
      {children}
    </p>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "press tap max-w-full truncate rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active ? "bg-volt text-black" : "bg-surface-2 text-text-2",
      )}
    >
      {label}
    </button>
  );
}
