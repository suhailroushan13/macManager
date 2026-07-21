import path from "node:path";
import { lstat, readdir } from "node:fs/promises";
import type {
  DevFolderCategory,
  FileCategory,
  ScanDevFolderStat,
  ScanDevSummary,
  ScanFileStat,
  ScanFolderStat,
  ScanMode,
  ScanProgress,
  ScanResult,
  ScanState,
} from "@/types/fs";
import { categorize, extensionOf } from "@/lib/file-category";
import { classifyDevFolder } from "@/lib/dev-folders";
import { loadLatestScanResultForRoot, saveScanResult } from "@/server/db/results-store";
import { loadFolderIndex, saveFolderIndex, type FolderIndexDoc } from "@/server/db/folder-index";
import { assertDirectory, normalizeAbsolute } from "./paths";

const LARGEST_FILES_TRACKED = 1000;
const FOLDER_STAT_DEPTH = 3;
const TOP_FOLDERS_RETURNED = 30;
const TOP_DEV_FOLDERS_RETURNED = 500;
const SKIPPED_DIRECTORIES = new Set([".Trash", "System", "private", "dev", "Volumes"]);

interface FolderAccumulator {
  bytes: number;
  files: number;
}

interface DevFolderAccumulator {
  category: DevFolderCategory;
  name: string;
  projectName: string;
  bytes: number;
  files: number;
  modifiedAt: number;
}

/**
 * Single background scan job for the whole process. Walks a tree iteratively,
 * aggregating sizes, categories, dev-folder classification, and largest files/folders.
 * Pause and cancel are cooperative flags checked between directories.
 *
 * In "rescan" mode, a directory whose own mtime matches the stored index is never
 * re-read: its subtree is reused wholesale from the last index instead of being walked
 * again. Directory mtime only changes when immediate entries are added/removed/renamed —
 * so a rescan can miss a file whose *content* changed without touching its parent's entry
 * list. That's the standard tradeoff for skipping unchanged subtrees; a full scan always
 * catches everything.
 */
class ScanEngine {
  private state: ScanState = "idle";
  private mode: ScanMode = "full";
  private root: string | null = null;
  private startedAt: number | null = null;
  private finishedAt: number | null = null;
  private currentPath: string | null = null;
  private cancelRequested = false;
  private pauseRequested = false;

  private filesScanned = 0;
  private foldersScanned = 0;
  private foldersReused = 0;
  private bytesScanned = 0;
  private errors = 0;
  private skipped = 0;
  private hiddenFiles = 0;
  private symlinks = 0;

  private categories = new Map<FileCategory, { files: number; bytes: number }>();
  private folderStats = new Map<string, FolderAccumulator>();
  /** Full-depth folder sizes (every ancestor directory, not just the depth-3 buckets) — this run only. */
  private folderSizes = new Map<string, FolderAccumulator>();
  /** Per-folder category breakdown, same ancestor-chain accumulation as folderSizes. */
  private categorySizes = new Map<string, Map<FileCategory, FolderAccumulator>>();
  private largestFiles: ScanFileStat[] = [];
  private oldestFile: ScanFileStat | null = null;
  private newestFile: ScanFileStat | null = null;

  /** Dev-folder roots discovered this run (e.g. every node_modules), keyed by their own path. */
  private devFolderRoots = new Map<string, DevFolderAccumulator>();
  /** Nearest enclosing dev-folder root for each directory, so files can be attributed to it in O(1). */
  private dirDevContext = new Map<string, string | null>();
  /** Each directory's own mtime as last observed — the change-detection signal for rescans. */
  private dirMtime = new Map<string, number>();
  /** Stored index for this root, loaded once at scan start for rescan comparisons. */
  private storedFolderIndex = new Map<string, FolderIndexDoc>();
  /** Directories confirmed present this run (whether freshly walked or reused unchanged). */
  private visitedPaths = new Set<string>();
  /** Directories reused unchanged — their descendants were never re-verified, so they stay presumed-present. */
  private reusedPaths = new Set<string>();

  async start(rawRoot: string, mode: ScanMode = "full"): Promise<void> {
    if (this.state === "running" || this.state === "paused") {
      throw new Error("A scan is already in progress.");
    }
    const root = normalizeAbsolute(rawRoot);
    await assertDirectory(root);
    this.reset();
    this.root = root;
    this.mode = mode;
    this.state = "running";
    this.startedAt = Date.now();

    this.storedFolderIndex = await loadFolderIndex(root);
    if (mode === "rescan") {
      const previous = await loadLatestScanResultForRoot(root);
      if (previous) {
        this.largestFiles = previous.largestFiles;
        this.oldestFile = previous.oldestFile;
        this.newestFile = previous.newestFile;
      }
    }
    const rootStats = await lstat(root);
    this.dirMtime.set(root, rootStats.mtimeMs);
    this.dirDevContext.set(root, null);

    // Fire and forget — progress is polled via status().
    void this.walk(root)
      .then(() => {
        this.state = this.cancelRequested ? "cancelled" : "done";
        this.finishedAt = Date.now();
        this.currentPath = null;
        // Persist completed scans so restarts (and refreshes) don't require a rescan.
        if (this.state === "done" && this.root) {
          void saveScanResult(this.result());
          const { docs, stalePaths } = this.buildFolderIndexDocs();
          void saveFolderIndex(this.root, docs, stalePaths);
        }
      })
      .catch(() => {
        this.state = "error";
        this.finishedAt = Date.now();
      });
  }

  pause(): void {
    if (this.state === "running") {
      this.pauseRequested = true;
      this.state = "paused";
    }
  }

  resume(): void {
    if (this.state === "paused") {
      this.pauseRequested = false;
      this.state = "running";
    }
  }

  cancel(): void {
    if (this.state === "running" || this.state === "paused") {
      this.cancelRequested = true;
      this.pauseRequested = false;
    }
  }

  progress(): ScanProgress {
    const elapsedMs = this.startedAt ? (this.finishedAt ?? Date.now()) - this.startedAt : 0;
    return {
      state: this.state,
      mode: this.mode,
      root: this.root,
      filesScanned: this.filesScanned,
      foldersScanned: this.foldersScanned,
      foldersReused: this.foldersReused,
      bytesScanned: this.bytesScanned,
      errors: this.errors,
      skipped: this.skipped,
      currentPath: this.currentPath,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      elapsedMs,
      filesPerSecond: elapsedMs > 0 ? Math.round((this.filesScanned / elapsedMs) * 1000) : 0,
      hiddenFiles: this.hiddenFiles,
      symlinks: this.symlinks,
    };
  }

  result(): ScanResult {
    const categories = [...this.categories.entries()]
      .map(([category, stat]) => ({ category, ...stat }))
      .sort((a, b) => b.bytes - a.bytes);
    const largestFolders: ScanFolderStat[] = [...this.folderStats.entries()]
      .map(([folderPath, stat]) => ({ path: folderPath, bytes: stat.bytes, files: stat.files }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, TOP_FOLDERS_RETURNED);
    return {
      progress: this.progress(),
      categories,
      largestFolders,
      largestFiles: this.largestFiles,
      averageFileSize: this.filesScanned > 0 ? this.bytesScanned / this.filesScanned : 0,
      oldestFile: this.oldestFile,
      newestFile: this.newestFile,
      devFolders: this.topDevFolders(),
      devSummary: this.devSummary(),
    };
  }

  private reset(): void {
    this.cancelRequested = false;
    this.pauseRequested = false;
    this.finishedAt = null;
    this.filesScanned = 0;
    this.foldersScanned = 0;
    this.foldersReused = 0;
    this.bytesScanned = 0;
    this.errors = 0;
    this.skipped = 0;
    this.hiddenFiles = 0;
    this.symlinks = 0;
    this.categories = new Map();
    this.folderStats = new Map();
    this.folderSizes = new Map();
    this.categorySizes = new Map();
    this.largestFiles = [];
    this.oldestFile = null;
    this.newestFile = null;
    this.devFolderRoots = new Map();
    this.dirDevContext = new Map();
    this.dirMtime = new Map();
    this.storedFolderIndex = new Map();
    this.visitedPaths = new Set();
    this.reusedPaths = new Set();
  }

  /** Live lookup used by the directory listing API — only valid for the most recently scanned root. */
  getFolderSize(dirPath: string): ScanFolderStat | null {
    if (!this.root) return null;
    const stat = this.folderSizes.get(dirPath);
    return stat ? { path: dirPath, bytes: stat.bytes, files: stat.files } : null;
  }

  private topDevFolders(): ScanDevFolderStat[] {
    return [...this.devFolderRoots.entries()]
      .map(([folderPath, stat]) => ({ path: folderPath, ...stat }))
      .sort((a, b) => b.bytes - a.bytes)
      .slice(0, TOP_DEV_FOLDERS_RETURNED);
  }

  private devSummary(): ScanDevSummary[] {
    const totals = new Map<DevFolderCategory, ScanDevSummary>();
    for (const dev of this.devFolderRoots.values()) {
      const entry = totals.get(dev.category) ?? { category: dev.category, bytes: 0, files: 0, folders: 0 };
      entry.bytes += dev.bytes;
      entry.files += dev.files;
      entry.folders += 1;
      totals.set(dev.category, entry);
    }
    return [...totals.values()].sort((a, b) => b.bytes - a.bytes);
  }

  private async waitWhilePaused(): Promise<void> {
    while (this.pauseRequested && !this.cancelRequested) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  /** Maps a file to the tracked folder bucket: its ancestor at most FOLDER_STAT_DEPTH below root. */
  private folderBucket(dirPath: string): string | null {
    if (!this.root) return null;
    const relative = path.relative(this.root, dirPath);
    if (relative === "" || relative.startsWith("..")) return this.root;
    const segments = relative.split(path.sep).slice(0, FOLDER_STAT_DEPTH);
    return path.join(this.root, ...segments);
  }

  private recordFile(entryPath: string, name: string, size: number, modifiedAt: number, birthMs: number): void {
    this.filesScanned += 1;
    this.bytesScanned += size;
    if (name.startsWith(".")) this.hiddenFiles += 1;

    const category = categorize(name, false);
    const categoryStat = this.categories.get(category) ?? { files: 0, bytes: 0 };
    categoryStat.files += 1;
    categoryStat.bytes += size;
    this.categories.set(category, categoryStat);

    const dirPath = path.dirname(entryPath);

    const bucket = this.folderBucket(dirPath);
    if (bucket) {
      const folderStat = this.folderStats.get(bucket) ?? { bytes: 0, files: 0 };
      folderStat.bytes += size;
      folderStat.files += 1;
      this.folderStats.set(bucket, folderStat);
    }
    this.accumulateFolderSize(dirPath, size);
    this.accumulateCategorySize(dirPath, category, size);

    const devRoot = this.dirDevContext.get(dirPath);
    if (devRoot) {
      const dev = this.devFolderRoots.get(devRoot);
      if (dev) {
        dev.bytes += size;
        dev.files += 1;
        if (modifiedAt > dev.modifiedAt) dev.modifiedAt = modifiedAt;
      }
    }

    const fileStat: ScanFileStat = {
      path: entryPath,
      name,
      bytes: size,
      extension: extensionOf(name),
      category,
      modifiedAt,
    };
    if (birthMs > 0 && (!this.oldestFile || birthMs < this.oldestFile.modifiedAt)) {
      this.oldestFile = { ...fileStat, modifiedAt: birthMs };
    }
    if (!this.newestFile || modifiedAt > this.newestFile.modifiedAt) {
      this.newestFile = fileStat;
    }

    // Keep a bounded top-N list; sorted insert is cheap because evictions are rare.
    if (this.largestFiles.length < LARGEST_FILES_TRACKED || size > this.largestFiles[this.largestFiles.length - 1].bytes) {
      const index = this.largestFiles.findIndex((candidate) => size > candidate.bytes);
      if (index === -1) this.largestFiles.push(fileStat);
      else this.largestFiles.splice(index, 0, fileStat);
      if (this.largestFiles.length > LARGEST_FILES_TRACKED) this.largestFiles.pop();
    }
  }

  /** Adds bytes/files to dirPath and every ancestor up to root, so any folder depth can be looked up later. */
  private accumulateFolderSize(dirPath: string, bytes: number, filesDelta = 1): void {
    if (!this.root) return;
    let current = dirPath;
    while (true) {
      const stat = this.folderSizes.get(current) ?? { bytes: 0, files: 0 };
      stat.bytes += bytes;
      stat.files += filesDelta;
      this.folderSizes.set(current, stat);
      if (current === this.root) break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  /** Same ancestor-chain accumulation as accumulateFolderSize, but broken out per category. */
  private accumulateCategorySize(dirPath: string, category: FileCategory, bytes: number, filesDelta = 1): void {
    if (!this.root) return;
    let current = dirPath;
    while (true) {
      const catMap = this.categorySizes.get(current) ?? new Map<FileCategory, FolderAccumulator>();
      const entry = catMap.get(category) ?? { bytes: 0, files: 0 };
      entry.bytes += bytes;
      entry.files += filesDelta;
      catMap.set(category, entry);
      this.categorySizes.set(current, catMap);
      if (current === this.root) break;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }

  /** Reuses a stored, unchanged folder's aggregate instead of re-reading its contents. */
  private reuseFolder(dirPath: string, stored: FolderIndexDoc): void {
    this.foldersReused += 1;
    this.bytesScanned += stored.bytes;
    this.filesScanned += stored.files;
    this.accumulateFolderSize(dirPath, stored.bytes, stored.files);
    for (const cat of stored.categoryBreakdown) {
      this.accumulateCategorySize(dirPath, cat.category, cat.bytes, cat.files);
      const categoryStat = this.categories.get(cat.category) ?? { files: 0, bytes: 0 };
      categoryStat.files += cat.files;
      categoryStat.bytes += cat.bytes;
      this.categories.set(cat.category, categoryStat);
    }
    if (stored.devCategory) {
      this.devFolderRoots.set(dirPath, {
        category: stored.devCategory,
        name: stored.name,
        projectName: stored.parentPath ? path.basename(stored.parentPath) : "",
        bytes: stored.bytes,
        files: stored.files,
        modifiedAt: stored.modifiedAt,
      });
    }
    this.dirMtime.set(dirPath, stored.modifiedAt);
    this.visitedPaths.add(dirPath);
    this.reusedPaths.add(dirPath);
  }

  /** Builds the folder-index docs to persist, plus the list of previously-indexed paths no longer present. */
  private buildFolderIndexDocs(): { docs: FolderIndexDoc[]; stalePaths: string[] } {
    const now = Date.now();
    const docs: FolderIndexDoc[] = [];
    if (!this.root) return { docs, stalePaths: [] };
    const root = this.root;

    for (const [dirPath, stat] of this.folderSizes.entries()) {
      const categoryBreakdown = [...(this.categorySizes.get(dirPath) ?? new Map()).entries()].map(
        ([category, value]) => ({ category, ...value }),
      );
      docs.push({
        path: dirPath,
        parentPath: dirPath === root ? null : path.dirname(dirPath),
        root,
        name: path.basename(dirPath),
        devCategory: this.devFolderRoots.get(dirPath)?.category ?? null,
        bytes: stat.bytes,
        files: stat.files,
        categoryBreakdown,
        modifiedAt: this.dirMtime.get(dirPath) ?? 0,
        lastIndexed: now,
      });
    }

    const stalePaths = [...this.storedFolderIndex.keys()].filter((storedPath) => {
      if (this.visitedPaths.has(storedPath)) return false;
      for (const reused of this.reusedPaths) {
        if (storedPath === reused || storedPath.startsWith(`${reused}${path.sep}`)) return false;
      }
      return true;
    });

    return { docs, stalePaths };
  }

  private async walk(root: string): Promise<void> {
    const queue: string[] = [root];
    while (queue.length > 0) {
      if (this.cancelRequested) return;
      await this.waitWhilePaused();
      if (this.cancelRequested) return;

      const dirPath = queue.pop();
      if (!dirPath) return;
      this.currentPath = dirPath;
      this.foldersScanned += 1;
      this.visitedPaths.add(dirPath);

      if (this.mode === "rescan") {
        const stored = this.storedFolderIndex.get(dirPath);
        const knownMtime = this.dirMtime.get(dirPath);
        if (stored && knownMtime !== undefined && stored.modifiedAt === knownMtime) {
          this.reuseFolder(dirPath, stored);
          continue; // Unchanged — never re-read, descendants are never re-visited either.
        }
      }

      let names: string[];
      try {
        names = await readdir(dirPath);
      } catch {
        this.errors += 1;
        continue;
      }

      for (const name of names) {
        const entryPath = path.join(dirPath, name);
        let stats;
        try {
          stats = await lstat(entryPath);
        } catch {
          this.errors += 1;
          continue;
        }
        if (stats.isSymbolicLink()) {
          this.symlinks += 1;
          continue; // Never follow symlinks — avoids cycles and double counting.
        }
        if (stats.isDirectory()) {
          if (dirPath === "/" && SKIPPED_DIRECTORIES.has(name)) {
            this.skipped += 1;
            continue;
          }
          this.dirMtime.set(entryPath, stats.mtimeMs);
          const devCategory = classifyDevFolder(name);
          if (devCategory) {
            this.dirDevContext.set(entryPath, entryPath);
            this.devFolderRoots.set(entryPath, {
              category: devCategory,
              name,
              projectName: path.basename(dirPath),
              bytes: 0,
              files: 0,
              modifiedAt: 0,
            });
          } else {
            this.dirDevContext.set(entryPath, this.dirDevContext.get(dirPath) ?? null);
          }
          // Always traversed — dev/build/cache folders are classified for the UI, never excluded from scanning.
          queue.push(entryPath);
        } else if (stats.isFile()) {
          this.recordFile(entryPath, name, stats.size, stats.mtimeMs, stats.birthtimeMs);
        }
      }
    }
  }
}

// Survive Next.js dev-server module reloads by pinning the engine to globalThis.
const globalStore = globalThis as typeof globalThis & { __scanEngine?: ScanEngine };

export function getScanEngine(): ScanEngine {
  globalStore.__scanEngine ??= new ScanEngine();
  return globalStore.__scanEngine;
}
