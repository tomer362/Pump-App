"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Check,
  FolderPlus,
  Pencil,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import {
  createFolder,
  deleteFolder,
  renameFolder,
  reorderFolders,
  setFolderColor,
  setFolderRotation,
} from "@/lib/actions/routine-folder";
import { FOLDER_COLORS, folderColorLabel, folderRail } from "@/lib/folder-color";
import type { FolderColor } from "@/lib/folder-color";
import type { FolderListItem } from "@/lib/queries/routine";
import { cn, haptic } from "@/lib/utils";

/**
 * Everything a folder can't do while it's a string on a routine: be created
 * empty, renamed in one place, recoloured, ordered, turned into a rotation, or
 * deleted without taking its routines with it.
 */
export function FolderManagerSheet({
  open,
  onClose,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  folders: FolderListItem[];
}) {
  const router = useRouter();
  const keyboardInset = useKeyboardInset();
  const [order, setOrder] = useState(folders);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  /**
   * Re-seed from the server whenever it sends a new list, so an optimistic
   * reorder is replaced by what actually persisted. Adjusted during render
   * rather than in an effect: an effect would paint the stale order first and
   * then cascade a second render over it.
   */
  const [seed, setSeed] = useState(folders);
  if (seed !== folders) {
    setSeed(folders);
    setOrder(folders);
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "That didn't work");
      router.refresh();
    });
  }

  /**
   * Up/down rather than drag-and-drop. Touch DnD inside a sheet that already
   * owns a vertical drag is a fight between two gestures, and these are real
   * 44px targets a thumb can hit while holding the phone one-handed.
   */
  function move(index: number, delta: number) {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
    haptic.light();
    run(() => reorderFolders(next.map((f) => f.id)));
  }

  return (
    <Sheet open={open} onClose={onClose} title="Folders" maxHeight="88dvh">
      <div
        className="px-4 pb-5"
        style={{ paddingBottom: keyboardInset ? keyboardInset + 20 : undefined }}
      >
        {order.length === 0 && (
          <p className="text-text-3 mb-4 text-[14px] leading-relaxed">
            A folder groups routines you train as one block — a Push/Pull/Legs
            week, an off-season phase. Turn on rotation and the folder tells you
            which day is up next.
          </p>
        )}

        <div className="space-y-2">
          {order.map((f, i) => (
            <FolderRow
              key={f.id}
              folder={f}
              editing={editingId === f.id}
              confirmingDelete={confirmDeleteId === f.id}
              canMoveUp={i > 0}
              canMoveDown={i < order.length - 1}
              onEdit={() => setEditingId(editingId === f.id ? null : f.id)}
              onMove={(d) => move(i, d)}
              onRename={(name) => {
                setEditingId(null);
                run(() => renameFolder(f.id, name));
              }}
              onColor={(c) => run(() => setFolderColor(f.id, c))}
              onRotation={(on) => run(() => setFolderRotation(f.id, on))}
              onAskDelete={() => setConfirmDeleteId(f.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              onDelete={() => {
                setConfirmDeleteId(null);
                setEditingId(null);
                run(() => deleteFolder(f.id));
              }}
            />
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New folder"
            maxLength={40}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                e.preventDefault();
                const name = newName.trim();
                setNewName("");
                run(() => createFolder({ name }));
              }
            }}
          />
          <Button
            variant="solid"
            disabled={!newName.trim()}
            onClick={() => {
              const name = newName.trim();
              if (!name) return;
              setNewName("");
              run(() => createFolder({ name }));
            }}
          >
            <FolderPlus className="size-4" />
            Add
          </Button>
        </div>

        {error && <p className="text-danger mt-3 text-[13px]">{error}</p>}
      </div>
    </Sheet>
  );
}

function RenameField({
  initial,
  onRename,
}: {
  initial: string;
  onRename: (name: string) => void;
}) {
  const [draft, setDraft] = useState(initial);
  const dirty = draft.trim() && draft.trim() !== initial;

  return (
    <div className="flex gap-2">
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={40}
        enterKeyHint="done"
        aria-label="Folder name"
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) {
            e.preventDefault();
            onRename(draft.trim());
          }
        }}
      />
      <Button
        variant="solid"
        disabled={!dirty}
        onClick={() => onRename(draft.trim())}
      >
        <Check className="size-4" />
        Save
      </Button>
    </div>
  );
}

function FolderRow({
  folder,
  editing,
  confirmingDelete,
  canMoveUp,
  canMoveDown,
  onEdit,
  onMove,
  onRename,
  onColor,
  onRotation,
  onAskDelete,
  onCancelDelete,
  onDelete,
}: {
  folder: FolderListItem;
  editing: boolean;
  confirmingDelete: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onEdit: () => void;
  onMove: (delta: number) => void;
  onRename: (name: string) => void;
  onColor: (c: FolderColor) => void;
  onRotation: (on: boolean) => void;
  onAskDelete: () => void;
  onCancelDelete: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border-hairline bg-surface-1 rounded-card overflow-hidden border">
      <div className="flex items-center gap-2 py-1 pr-1 pl-3">
        <span
          aria-hidden
          className={cn("h-6 w-[3px] shrink-0 rounded-full", folderRail(folder.color))}
        />
        <div className="min-w-0 flex-1 py-1.5">
          <p className="truncate text-[15px] font-medium">{folder.name}</p>
          <p className="text-text-3 num text-[12px]">
            {folder.routineCount} routine{folder.routineCount === 1 ? "" : "s"}
            {folder.rotation && " · rotation"}
          </p>
        </div>

        <button
          onClick={() => onMove(-1)}
          disabled={!canMoveUp}
          aria-label={`Move ${folder.name} up`}
          className="press tap text-text-3 grid size-11 place-items-center disabled:opacity-25"
        >
          <ArrowUp className="size-[18px]" strokeWidth={2.4} />
        </button>
        <button
          onClick={() => onMove(1)}
          disabled={!canMoveDown}
          aria-label={`Move ${folder.name} down`}
          className="press tap text-text-3 grid size-11 place-items-center disabled:opacity-25"
        >
          <ArrowDown className="size-[18px]" strokeWidth={2.4} />
        </button>
        <button
          onClick={onEdit}
          aria-expanded={editing}
          aria-label={`Edit ${folder.name}`}
          className={cn(
            "press tap grid size-11 place-items-center",
            editing ? "text-text-1" : "text-text-3",
          )}
        >
          {editing ? (
            <X className="size-[18px]" strokeWidth={2.4} />
          ) : (
            <Pencil className="size-[17px]" strokeWidth={2.2} />
          )}
        </button>
      </div>

      {editing && (
        <div className="border-hairline space-y-3 border-t px-3 py-3">
          {/* Mounted on demand and keyed by the current name, so the draft
              starts from the truth without an effect to sync it. */}
          <RenameField
            key={folder.name}
            initial={folder.name}
            onRename={onRename}
          />

          <div className="flex items-center gap-2">
            {FOLDER_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onColor(c)}
                aria-label={folderColorLabel(c)}
                aria-pressed={folder.color === c}
                className="press tap grid size-11 place-items-center"
              >
                <span
                  className={cn(
                    "size-6 rounded-full transition-transform",
                    folderRail(c),
                    folder.color === c &&
                      "ring-text-1 ring-offset-surface-1 scale-110 ring-2 ring-offset-2",
                  )}
                />
              </button>
            ))}
          </div>

          <button
            onClick={() => onRotation(!folder.rotation)}
            aria-pressed={folder.rotation}
            className="press tap flex w-full items-center gap-2.5 py-2 text-left"
          >
            <Repeat
              className={cn(
                "size-[18px] shrink-0",
                folder.rotation ? "text-volt" : "text-text-3",
              )}
              strokeWidth={2.2}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">
                Rotation {folder.rotation ? "on" : "off"}
              </span>
              <span className="text-text-3 block text-[12px] leading-snug">
                Treat this folder as a cycle and show which routine is up next.
              </span>
            </span>
            <span
              className={cn(
                "h-[26px] w-[44px] shrink-0 rounded-full p-[3px] transition-colors",
                folder.rotation ? "bg-volt" : "bg-surface-3",
              )}
            >
              <span
                className={cn(
                  "block size-5 rounded-full bg-white transition-transform",
                  folder.rotation ? "translate-x-[18px]" : "translate-x-0",
                )}
              />
            </span>
          </button>

          {confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-text-2 text-[13px] leading-relaxed">
                {folder.routineCount === 0
                  ? "The folder is removed."
                  : `The folder is removed. Its ${folder.routineCount} routine${
                      folder.routineCount === 1 ? "" : "s"
                    } move to Unfiled — nothing is deleted.`}
              </p>
              <div className="flex gap-2">
                <Button block variant="danger" onClick={onDelete}>
                  <Trash2 className="size-4" />
                  Delete folder
                </Button>
                <Button block variant="ghost" onClick={onCancelDelete}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              block
              variant="ghost"
              className="text-danger"
              onClick={onAskDelete}
            >
              Delete folder
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
