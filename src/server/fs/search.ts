import path from "node:path";
import { lstat, readdir } from "node:fs/promises";
import type { FileEntry, SearchRequest, SearchResponse } from "@/types/fs";
import { extensionOf } from "@/lib/file-category";
import { toFileEntry } from "./entries";
import { ownerName } from "./owners";
import { assertDirectory, normalizeAbsolute } from "./paths";

const DEFAULT_MAX_RESULTS = 300;
const MAX_VISITED_ENTRIES = 250_000;
const TIME_BUDGET_MS = 12_000;
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git", ".Trash", "Library/Caches"]);

type Matcher = (name: string) => boolean;

function fuzzyMatches(query: string, candidate: string): boolean {
  let queryIndex = 0;
  for (let i = 0; i < candidate.length && queryIndex < query.length; i += 1) {
    if (candidate[i] === query[queryIndex]) queryIndex += 1;
  }
  return queryIndex === query.length;
}

function buildMatcher(request: SearchRequest): Matcher {
  const { mode, caseSensitive } = request;
  const query = caseSensitive ? request.query : request.query.toLowerCase();
  const normalize = (name: string) => (caseSensitive ? name : name.toLowerCase());

  if (mode === "regex") {
    const pattern = new RegExp(request.query, caseSensitive ? "" : "i");
    return (name) => pattern.test(name);
  }
  if (mode === "startsWith") return (name) => normalize(name).startsWith(query);
  if (mode === "endsWith") return (name) => normalize(name).endsWith(query);
  if (mode === "fuzzy") return (name) => fuzzyMatches(query, normalize(name));
  return (name) => normalize(name).includes(query);
}

/**
 * Bounded breadth-first filename search. Hard limits on visited entries and
 * wall time keep a search over a huge tree from pinning the server.
 */
export async function searchFiles(request: SearchRequest): Promise<SearchResponse> {
  const root = normalizeAbsolute(request.root);
  await assertDirectory(root);
  const matcher = buildMatcher(request);
  const maxResults = Math.min(request.maxResults ?? DEFAULT_MAX_RESULTS, 1000);
  const wantedExtensions = request.extensions?.length ? new Set(request.extensions) : null;

  const startedAt = Date.now();
  const results: FileEntry[] = [];
  const queue: string[] = [root];
  let visited = 0;
  let truncated = false;

  while (queue.length > 0) {
    if (Date.now() - startedAt > TIME_BUDGET_MS || visited > MAX_VISITED_ENTRIES) {
      truncated = true;
      break;
    }
    const dirPath = queue.shift();
    if (!dirPath) break;

    let names: string[];
    try {
      names = await readdir(dirPath);
    } catch {
      continue; // Permission denied or vanished — skip silently, count nothing.
    }

    for (const name of names) {
      visited += 1;
      const isHidden = name.startsWith(".");
      if (isHidden && !request.includeHidden) continue;

      const entryPath = path.join(dirPath, name);
      let stats;
      try {
        stats = await lstat(entryPath);
      } catch {
        continue;
      }

      if (stats.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(name)) queue.push(entryPath);
      }

      if (!matcher(name)) continue;
      if (wantedExtensions && !wantedExtensions.has(extensionOf(name))) continue;

      results.push(toFileEntry(entryPath, name, stats, await ownerName(stats.uid)));
      if (results.length >= maxResults) {
        return { results, visited, truncated: true, elapsedMs: Date.now() - startedAt };
      }
    }
  }

  return { results, visited, truncated, elapsedMs: Date.now() - startedAt };
}
