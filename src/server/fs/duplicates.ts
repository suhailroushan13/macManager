import path from "node:path";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, lstat, open, readdir } from "node:fs/promises";
import type { DuplicateGroup, DuplicateProgress, DuplicateResult, DuplicateState } from "@/types/fs";
import { saveDuplicateResult } from "@/server/db/results-store";
import { assertDirectory, normalizeAbsolute } from "./paths";

const MAX_FILES_CONSIDERED = 200_000;
const PARTIAL_HASH_BYTES = 128 * 1024;
const FULL_HASH_MAX_BYTES = 512 * 1024 * 1024;
const FULL_HASH_TOTAL_BUDGET = 20 * 1024 * 1024 * 1024;
const MAX_GROUPS_RETURNED = 200;
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", ".Trash", "Library"]);

interface Candidate {
  path: string;
  bytes: number;
}

async function hashPartial(filePath: string): Promise<string> {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(PARTIAL_HASH_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, PARTIAL_HASH_BYTES, 0);
    return createHash("md5").update(buffer.subarray(0, bytesRead)).digest("hex");
  } finally {
    await handle.close();
  }
}

function hashFull(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("md5");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", reject);
  });
}

/**
 * Single background duplicate-finder job. Three passes: collect files by size,
 * hash the first 128 KiB of same-size candidates, then fully hash surviving
 * groups (within a byte budget) so reported groups are true duplicates.
 */
class DuplicateEngine {
  private state: DuplicateState = "idle";
  private root: string | null = null;
  private minSize = 0;
  private cancelRequested = false;
  private startedAt: number | null = null;
  private finishedAt: number | null = null;

  private filesConsidered = 0;
  private filesHashed = 0;
  private bytesHashed = 0;
  private truncated = false;
  private groups: DuplicateGroup[] = [];

  async start(rawRoot: string, minSize: number): Promise<void> {
    if (this.state === "running") throw new Error("A duplicate scan is already in progress.");
    const root = normalizeAbsolute(rawRoot);
    await assertDirectory(root);
    this.reset();
    this.root = root;
    this.minSize = minSize;
    this.state = "running";
    this.startedAt = Date.now();
    void this.run(root, minSize)
      .then((groups) => {
        this.groups = groups;
        this.state = this.cancelRequested ? "cancelled" : "done";
        this.finishedAt = Date.now();
        // Persist completed runs so restarts don't require a re-run.
        if (this.state === "done") void saveDuplicateResult(this.result());
      })
      .catch(() => {
        this.state = "error";
        this.finishedAt = Date.now();
      });
  }

  cancel(): void {
    if (this.state === "running") this.cancelRequested = true;
  }

  progress(): DuplicateProgress {
    const wastedBytes = this.groups.reduce((sum, group) => sum + (group.files.length - 1) * group.bytes, 0);
    return {
      state: this.state,
      root: this.root,
      minSize: this.minSize,
      filesConsidered: this.filesConsidered,
      filesHashed: this.filesHashed,
      bytesHashed: this.bytesHashed,
      groupsFound: this.groups.length,
      wastedBytes,
      truncated: this.truncated,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      elapsedMs: this.startedAt ? (this.finishedAt ?? Date.now()) - this.startedAt : 0,
    };
  }

  result(): DuplicateResult {
    return { progress: this.progress(), groups: this.groups };
  }

  private reset(): void {
    this.cancelRequested = false;
    this.finishedAt = null;
    this.filesConsidered = 0;
    this.filesHashed = 0;
    this.bytesHashed = 0;
    this.truncated = false;
    this.groups = [];
  }

  private async collectBySize(root: string, minSize: number): Promise<Map<number, Candidate[]>> {
    const bySize = new Map<number, Candidate[]>();
    const queue: string[] = [root];
    while (queue.length > 0 && !this.cancelRequested) {
      const dirPath = queue.pop();
      if (!dirPath) break;
      let names: string[];
      try {
        names = await readdir(dirPath);
      } catch {
        continue;
      }
      for (const name of names) {
        if (this.filesConsidered >= MAX_FILES_CONSIDERED) {
          this.truncated = true;
          return bySize;
        }
        const entryPath = path.join(dirPath, name);
        let stats;
        try {
          stats = await lstat(entryPath);
        } catch {
          continue;
        }
        if (stats.isSymbolicLink()) continue;
        if (stats.isDirectory()) {
          if (!SKIPPED_DIRECTORIES.has(name)) queue.push(entryPath);
          continue;
        }
        if (!stats.isFile() || stats.size < minSize) continue;
        this.filesConsidered += 1;
        const bucket = bySize.get(stats.size) ?? [];
        bucket.push({ path: entryPath, bytes: stats.size });
        bySize.set(stats.size, bucket);
      }
    }
    return bySize;
  }

  private async groupByHash(
    candidates: Candidate[],
    hasher: (filePath: string) => Promise<string>,
    countBytes: (bytes: number) => number,
  ): Promise<Map<string, Candidate[]>> {
    const byHash = new Map<string, Candidate[]>();
    for (const candidate of candidates) {
      if (this.cancelRequested) break;
      try {
        const hash = await hasher(candidate.path);
        this.filesHashed += 1;
        this.bytesHashed += countBytes(candidate.bytes);
        const bucket = byHash.get(hash) ?? [];
        bucket.push(candidate);
        byHash.set(hash, bucket);
      } catch {
        // Unreadable file — drop it from candidacy rather than fail the run.
      }
    }
    return byHash;
  }

  private async run(root: string, minSize: number): Promise<DuplicateGroup[]> {
    const bySize = await this.collectBySize(root, minSize);
    const groups: DuplicateGroup[] = [];
    let fullHashBudget = FULL_HASH_TOTAL_BUDGET;

    for (const [bytes, candidates] of bySize) {
      if (this.cancelRequested) break;
      if (candidates.length < 2) continue;

      const byPartial = await this.groupByHash(candidates, hashPartial, (size) =>
        Math.min(size, PARTIAL_HASH_BYTES),
      );

      for (const [partialHash, partialGroup] of byPartial) {
        if (this.cancelRequested) break;
        if (partialGroup.length < 2) continue;

        // Small files are fully covered by the partial read — no second pass needed.
        const fullyReadByPartial = bytes <= PARTIAL_HASH_BYTES;
        const groupCost = bytes * partialGroup.length;
        const canFullHash = !fullyReadByPartial && bytes <= FULL_HASH_MAX_BYTES && groupCost <= fullHashBudget;

        if (fullyReadByPartial || !canFullHash) {
          groups.push({
            hash: fullyReadByPartial ? partialHash : `partial:${partialHash}`,
            bytes,
            files: partialGroup.map((candidate) => candidate.path).sort(),
          });
          continue;
        }

        fullHashBudget -= groupCost;
        const byFull = await this.groupByHash(partialGroup, hashFull, (size) => size);
        for (const [fullHash, fullGroup] of byFull) {
          if (fullGroup.length < 2) continue;
          groups.push({
            hash: fullHash,
            bytes,
            files: fullGroup.map((candidate) => candidate.path).sort(),
          });
        }
      }
    }

    // Biggest waste first; cap the payload.
    groups.sort((a, b) => (b.files.length - 1) * b.bytes - (a.files.length - 1) * a.bytes);
    if (groups.length > MAX_GROUPS_RETURNED) {
      this.truncated = true;
      groups.length = MAX_GROUPS_RETURNED;
    }
    return groups;
  }
}

/** Drops files no longer on disk (e.g. already trashed) so a refresh reflects the true state. */
export async function pruneMissingFiles(result: DuplicateResult): Promise<DuplicateResult> {
  const groups: DuplicateGroup[] = [];
  for (const group of result.groups) {
    const survivors: string[] = [];
    for (const filePath of group.files) {
      try {
        await access(filePath);
        survivors.push(filePath);
      } catch {
        // Gone — drop it.
      }
    }
    if (survivors.length > 1) groups.push({ ...group, files: survivors });
  }
  return { ...result, groups };
}

const globalStore = globalThis as typeof globalThis & { __duplicateEngine?: DuplicateEngine };

export function getDuplicateEngine(): DuplicateEngine {
  globalStore.__duplicateEngine ??= new DuplicateEngine();
  return globalStore.__duplicateEngine;
}
