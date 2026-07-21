import path from "node:path";
import { access, rename } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PathError, normalizeAbsolute } from "./paths";

const execFileAsync = promisify(execFile);

/** Opens a file or folder with the system default application. */
export async function openInSystem(rawPath: string): Promise<void> {
  const target = normalizeAbsolute(rawPath);
  await execFileAsync("open", [target], { timeout: 5000 });
}

/** Reveals the item in Finder. */
export async function revealInFinder(rawPath: string): Promise<void> {
  const target = normalizeAbsolute(rawPath);
  await execFileAsync("open", ["-R", target], { timeout: 5000 });
}

/** Opens a Terminal window at the given directory. */
export async function openTerminalAt(rawPath: string): Promise<void> {
  const target = normalizeAbsolute(rawPath);
  await execFileAsync("open", ["-a", "Terminal", target], { timeout: 5000 });
}

/**
 * Moves items to the macOS Trash via Finder so the action is user-recoverable.
 * Never a permanent delete.
 */
export async function moveToTrash(rawPaths: string[]): Promise<void> {
  if (rawPaths.length === 0 || rawPaths.length > 100) {
    throw new PathError("INVALID_PATH", "Provide between 1 and 100 paths.");
  }
  const targets = rawPaths.map(normalizeAbsolute);

  // Stale UI state (e.g. a duplicate already trashed in a prior action) points at a path
  // that's gone — Finder can't resolve a POSIX file reference to a missing item and fails
  // with -10010 ("Handler can't handle objects of this class"). Treat already-gone targets
  // as already trashed instead of erroring.
  const existing: string[] = [];
  for (const target of targets) {
    try {
      await access(target);
      existing.push(target);
    } catch {
      // Already gone — nothing to trash.
    }
  }
  if (existing.length === 0) return;

  // Finder's `delete` verb rejects raw POSIX file specifiers with -10010, and coercing to
  // `alias` first can itself fail with -1700 for some filenames (parens, trailing numbers).
  // `move ... to trash` is the pattern Apple documents for this and accepts POSIX file
  // references directly, no coercion needed.
  const list = existing.map((target) => `POSIX file ${JSON.stringify(target)}`).join(", ");
  await execFileAsync("osascript", ["-e", `tell application "Finder" to move {${list}} to trash`], {
    timeout: 30_000,
  });
}

/** Renames an item within its current directory. */
export async function renameItem(rawPath: string, newName: string): Promise<string> {
  const source = normalizeAbsolute(rawPath);
  if (!newName || newName.includes("/") || newName.includes("\0") || newName === "." || newName === "..") {
    throw new PathError("INVALID_PATH", "New name must be a plain file name.");
  }
  const destination = path.join(path.dirname(source), newName);
  await rename(source, destination);
  return destination;
}
