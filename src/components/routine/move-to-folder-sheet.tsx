"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, FolderPlus, Inbox } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input, List, ListRow } from "@/components/ui/primitives";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import {
  createFolder,
  moveRoutineToFolder,
} from "@/lib/actions/routine-folder";
import { folderRail } from "@/lib/folder-color";
import type { FolderListItem } from "@/lib/queries/routine";
import { cn, haptic } from "@/lib/utils";

/**
 * Filing from wherever the routine already is. The old path was: open the
 * routine, open the editor, find the folder field, retype the name, save — and
 * that save rewrote every set row underneath.
 */
export function MoveToFolderSheet({
  open,
  onClose,
  routineId,
  routineName,
  currentFolderId,
  folders,
}: {
  open: boolean;
  onClose: () => void;
  routineId: string;
  routineName: string;
  currentFolderId: string | null;
  folders: FolderListItem[];
}) {
  const router = useRouter();
  const keyboardInset = useKeyboardInset();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function move(folderId: string | null) {
    haptic.light();
    setError(null);
    startTransition(async () => {
      const res = await moveRoutineToFolder(routineId, folderId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
      onClose();
    });
  }

  function createAndMove() {
    const name = newName.trim();
    if (!name) return;
    setError(null);
    startTransition(async () => {
      const created = await createFolder({ name });
      if (!created.ok) {
        setError(created.error);
        return;
      }
      const res = await moveRoutineToFolder(
        routineId,
        created.data!.folderId,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNewName("");
      router.refresh();
      onClose();
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Move ${routineName}`}>
      <div
        className="px-4 pb-5"
        style={{ paddingBottom: keyboardInset ? keyboardInset + 20 : undefined }}
      >
        <List>
          <ListRow
            onClick={() => move(null)}
            leading={<Inbox className="text-text-3 size-[18px]" strokeWidth={2.2} />}
            title="Unfiled"
            trailing={
              currentFolderId === null ? (
                <Check className="text-volt size-[18px]" strokeWidth={2.6} />
              ) : undefined
            }
          />
          {folders.map((f) => (
            <ListRow
              key={f.id}
              onClick={() => move(f.id)}
              leading={
                <span
                  aria-hidden
                  className={cn(
                    "h-5 w-[3px] shrink-0 rounded-full",
                    folderRail(f.color),
                  )}
                />
              }
              title={f.name}
              subtitle={`${f.routineCount} routine${f.routineCount === 1 ? "" : "s"}`}
              trailing={
                currentFolderId === f.id ? (
                  <Check className="text-volt size-[18px]" strokeWidth={2.6} />
                ) : undefined
              }
            />
          ))}
        </List>

        <div className="mt-3 flex gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New folder"
            maxLength={40}
            enterKeyHint="done"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createAndMove();
              }
            }}
          />
          <Button
            variant="solid"
            disabled={!newName.trim()}
            onClick={createAndMove}
          >
            <FolderPlus className="size-4" />
            Create
          </Button>
        </div>

        {error && <p className="text-danger mt-3 text-[13px]">{error}</p>}
      </div>
    </Sheet>
  );
}
