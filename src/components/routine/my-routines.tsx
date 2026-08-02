"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  FolderCog,
  Play,
  Repeat,
  Upload,
} from "lucide-react";
import { RoutineCard } from "./routine-card";
import { FolderManagerSheet } from "./folder-manager-sheet";
import { ImportRoutineButton } from "./routine-transfer-sheets";
import { useCollapsedFolders } from "@/hooks/use-collapsed-folders";
import { reorderRoutinesInFolder } from "@/lib/actions/routine-folder";
import { startWorkoutFromRoutine } from "@/lib/actions/workout";
import { folderRail } from "@/lib/folder-color";
import type { FolderListItem, RoutineListItem } from "@/lib/queries/routine";
import { cn, haptic } from "@/lib/utils";

const UNFILED = "__unfiled";

export function MyRoutines({
  routines,
  folders,
  hasActiveWorkout,
}: {
  routines: RoutineListItem[];
  folders: FolderListItem[];
  hasActiveWorkout: boolean;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const { collapsed, toggle } = useCollapsedFolders();

  const byFolder = new Map<string, RoutineListItem[]>();
  for (const r of routines) {
    const key = r.folderId ?? UNFILED;
    const list = byFolder.get(key) ?? [];
    list.push(r);
    byFolder.set(key, list);
  }
  const unfiled = byFolder.get(UNFILED) ?? [];

  return (
    <>
      <div className="mb-3 flex items-center justify-end gap-4">
        <ImportRoutineButton className="press tap text-text-3 hover:text-text-1 flex items-center gap-1.5 py-2 text-[13px] font-semibold">
          <Upload className="size-4" strokeWidth={2.2} />
          Import
        </ImportRoutineButton>
        <button
          onClick={() => {
            haptic.light();
            setManageOpen(true);
          }}
          className="press tap text-text-3 hover:text-text-1 flex items-center gap-1.5 py-2 text-[13px] font-semibold"
        >
          <FolderCog className="size-4" strokeWidth={2.2} />
          {folders.length ? "Folders" : "New folder"}
        </button>
      </div>

      <div className="space-y-5">
        {folders.map((f) => (
          <FolderSection
            key={f.id}
            folder={f}
            routines={byFolder.get(f.id) ?? []}
            collapsed={collapsed.has(f.id)}
            onToggle={() => toggle(f.id)}
            hasActiveWorkout={hasActiveWorkout}
          />
        ))}

        {unfiled.length > 0 && (
          <div>
            {folders.length > 0 && (
              <button
                onClick={() => toggle(UNFILED)}
                aria-expanded={!collapsed.has(UNFILED)}
                className="press mb-2 flex w-full items-center gap-2 py-1 text-left"
              >
                <h3 className="text-text-3 flex-1 text-[11px] font-semibold tracking-[0.08em] uppercase">
                  Unfiled
                </h3>
                <span className="text-text-3 num text-[11px]">
                  {unfiled.length}
                </span>
                <ChevronDown
                  className={cn(
                    "text-text-3 size-4 transition-transform",
                    collapsed.has(UNFILED) && "-rotate-90",
                  )}
                  strokeWidth={2.4}
                />
              </button>
            )}
            {!collapsed.has(UNFILED) && (
              <div className="space-y-2">
                {unfiled.map((r) => (
                  <RoutineCard key={r.id} routine={r} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <FolderManagerSheet
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        folders={folders}
      />
    </>
  );
}

function FolderSection({
  folder,
  routines,
  collapsed,
  onToggle,
  hasActiveWorkout,
}: {
  folder: FolderListItem;
  routines: RoutineListItem[];
  collapsed: boolean;
  onToggle: () => void;
  hasActiveWorkout: boolean;
}) {
  const router = useRouter();
  const [starting, startTransition] = useTransition();
  const [reordering, setReordering] = useState(false);
  const [order, setOrder] = useState(routines);

  // Replaced by the server's list whenever it changes, adjusted during render
  // rather than in an effect so the optimistic order never paints twice.
  const [seed, setSeed] = useState(routines);
  if (seed !== routines) {
    setSeed(routines);
    setOrder(routines);
  }

  function move(index: number, delta: number) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    haptic.light();
    startTransition(async () => {
      await reorderRoutinesInFolder(
        folder.id,
        next.map((r) => r.id),
      );
      router.refresh();
    });
  }

  const nextName =
    folder.nextRoutineName ??
    routines.find((r) => r.id === folder.nextRoutineId)?.name ??
    null;
  const showNextUp =
    folder.rotation && folder.nextRoutineId && nextName && !hasActiveWorkout;

  function startNext() {
    if (!folder.nextRoutineId) return;
    haptic.light();
    startTransition(async () => {
      const res = await startWorkoutFromRoutine(folder.nextRoutineId!, 1);
      if (res.ok && res.data) router.push(`/workout/${res.data.workoutId}`);
    });
  }

  return (
    <div>
      <button
        onClick={onToggle}
        aria-expanded={!collapsed}
        className="press mb-2 flex w-full items-center gap-2 py-1 text-left"
      >
        <span
          aria-hidden
          className={cn("h-3.5 w-[3px] shrink-0 rounded-full", folderRail(folder.color))}
        />
        <h3 className="text-text-3 min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.08em] uppercase">
          {folder.name}
        </h3>
        {folder.rotation && (
          <Repeat className="text-text-3 size-3.5 shrink-0" strokeWidth={2.4} />
        )}
        <span className="text-text-3 num text-[11px]">{order.length}</span>
        <ChevronDown
          className={cn(
            "text-text-3 size-4 shrink-0 transition-transform",
            collapsed && "-rotate-90",
          )}
          strokeWidth={2.4}
        />
      </button>

      {/* Up next stays visible when the folder is collapsed — a rotation you
          have to expand to read is just a folder again. */}
      {showNextUp && (
        <div className="border-hairline bg-surface-1 rounded-card mb-2 flex items-center gap-3 border px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-text-3 text-[11px] font-semibold tracking-[0.06em] uppercase">
              Up next
            </p>
            <p className="mt-0.5 truncate text-[15px] font-semibold">{nextName}</p>
          </div>
          <button
            onClick={startNext}
            disabled={starting}
            aria-label={`Start ${nextName}`}
            className="press tap bg-volt grid size-11 shrink-0 place-items-center rounded-full text-black disabled:opacity-60"
          >
            <Play className="size-[18px]" fill="currentColor" />
          </button>
        </div>
      )}

      {!collapsed && (
        <div className="space-y-2">
          {order.length === 0 ? (
            <p className="text-text-3 border-hairline rounded-card border border-dashed px-4 py-3 text-[13px]">
              Empty — move a routine here from its own screen.
            </p>
          ) : reordering ? (
            order.map((r, i) => (
              <div
                key={r.id}
                className="border-hairline bg-surface-1 rounded-card flex items-center gap-2 border py-1 pr-1 pl-4"
              >
                <p className="min-w-0 flex-1 truncate py-2 text-[15px] font-medium">
                  {r.name}
                </p>
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${r.name} up`}
                  className="press tap text-text-3 grid size-11 place-items-center disabled:opacity-25"
                >
                  <ArrowUp className="size-[18px]" strokeWidth={2.4} />
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  aria-label={`Move ${r.name} down`}
                  className="press tap text-text-3 grid size-11 place-items-center disabled:opacity-25"
                >
                  <ArrowDown className="size-[18px]" strokeWidth={2.4} />
                </button>
              </div>
            ))
          ) : (
            order.map((r) => <RoutineCard key={r.id} routine={r} />)
          )}

          {/* Order is what a rotation cycles through, so it has to be settable
              — but only when asked for, or every list row grows two arrows. */}
          {order.length > 1 && (
            <button
              onClick={() => {
                haptic.light();
                setReordering((v) => !v);
              }}
              className="press tap text-text-3 hover:text-text-1 flex items-center gap-1.5 py-2 text-[12px] font-semibold"
            >
              {reordering ? (
                <>
                  <Check className="size-3.5" strokeWidth={2.6} />
                  Done
                </>
              ) : (
                <>
                  <ArrowUp className="size-3.5" strokeWidth={2.6} />
                  Reorder
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
