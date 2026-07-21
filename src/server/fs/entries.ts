import path from "node:path";
import { lstat, readdir } from "node:fs/promises";
import type { Stats } from "node:fs";
import type { DirListing, FileEntry, FileKind } from "@/types/fs";
import { categorize, extensionOf } from "@/lib/file-category";
import { findFolderIndexEntry } from "@/server/db/folder-index";
import { getScanEngine } from "./scanner";
import { ownerName } from "./owners";
import { assertDirectory, normalizeAbsolute } from "./paths";

const MAX_ENTRIES_PER_LISTING = 5000;

function permissionString(mode: number): string {
  const flags = ["r", "w", "x"];
  let result = "";
  for (let shift = 8; shift >= 0; shift -= 1) {
    result += mode & (1 << shift) ? flags[(8 - shift) % 3] : "-";
  }
  return result;
}

function kindOf(stats: Stats): FileKind {
  if (stats.isSymbolicLink()) return "symlink";
  if (stats.isDirectory()) return "directory";
  return "file";
}

export function toFileEntry(entryPath: string, name: string, stats: Stats, owner: string): FileEntry {
  const kind = kindOf(stats);
  const isDirectory = kind === "directory";
  return {
    name,
    path: entryPath,
    kind,
    category: categorize(name, isDirectory),
    extension: isDirectory ? "" : extensionOf(name),
    size: isDirectory ? 0 : stats.size,
    createdAt: stats.birthtimeMs,
    modifiedAt: stats.mtimeMs,
    accessedAt: stats.atimeMs,
    owner,
    permissions: permissionString(stats.mode),
    isHidden: name.startsWith("."),
    isReadonly: (stats.mode & 0o200) === 0,
    isExecutable: !isDirectory && (stats.mode & 0o111) !== 0,
  };
}

/** Lists a directory with full stat metadata, capped to keep responses bounded. */
export async function listDirectory(rawPath: string): Promise<DirListing> {
  const dirPath = normalizeAbsolute(rawPath);
  await assertDirectory(dirPath);

  const names = await readdir(dirPath);
  const truncated = names.length > MAX_ENTRIES_PER_LISTING;
  const visible = truncated ? names.slice(0, MAX_ENTRIES_PER_LISTING) : names;

  const entries = await Promise.all(
    visible.map(async (name): Promise<FileEntry | null> => {
      const entryPath = path.join(dirPath, name);
      try {
        const stats = await lstat(entryPath);
        const owner = await ownerName(stats.uid);
        return toFileEntry(entryPath, name, stats, owner);
      } catch {
        return null; // Entry vanished or is unreadable — skip rather than fail the listing.
      }
    }),
  );

  const resolvedEntries = entries.filter((entry): entry is FileEntry => entry !== null);
  await attachFolderSizes(resolvedEntries);

  const parent = path.dirname(dirPath);
  return {
    path: dirPath,
    parent: parent === dirPath ? null : parent,
    entries: resolvedEntries,
    truncated,
  };
}

/**
 * Fills in `size` for directory entries from the last scan of an ancestor root, if one exists.
 * Checks the in-process scan engine first (always current for the most recent scan), then falls
 * back to the bounded db snapshot. Folders never covered by a scan are left at size 0 (shown as
 * "—" in the UI) rather than walked on demand, which would make every directory listing slow.
 */
async function attachFolderSizes(entries: FileEntry[]): Promise<void> {
  const directories = entries.filter((entry) => entry.kind === "directory");
  if (directories.length === 0) return;

  const engine = getScanEngine();

  await Promise.all(
    directories.map(async (entry) => {
      const live = engine.getFolderSize(entry.path);
      if (live) {
        entry.size = live.bytes;
        return;
      }
      const stored = await findFolderIndexEntry(entry.path);
      if (stored) entry.size = stored.bytes;
    }),
  );
}
