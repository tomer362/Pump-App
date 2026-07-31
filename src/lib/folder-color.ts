import { FOLDER_COLORS, type FolderColor } from "@/lib/db/schema";

/**
 * Folder colours are looked up rather than interpolated into a class name:
 * Tailwind scans source text for complete class strings, so a template like
 * `bg-folder-${color}` compiles to nothing at all.
 */
const RAIL: Record<FolderColor, string> = {
  slate: "bg-folder-slate",
  sand: "bg-folder-sand",
  clay: "bg-folder-clay",
  moss: "bg-folder-moss",
  sky: "bg-folder-sky",
  plum: "bg-folder-plum",
};

const LABEL: Record<FolderColor, string> = {
  slate: "Slate",
  sand: "Sand",
  clay: "Clay",
  moss: "Moss",
  sky: "Sky",
  plum: "Plum",
};

export function folderRail(color: FolderColor) {
  return RAIL[color] ?? RAIL.slate;
}

export function folderColorLabel(color: FolderColor) {
  return LABEL[color] ?? LABEL.slate;
}

export { FOLDER_COLORS };
export type { FolderColor };
