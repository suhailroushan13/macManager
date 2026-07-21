/** Shared filesystem domain types used by both server services and the client. */

export type FileKind = "file" | "directory" | "symlink";

export type FileCategory =
  | "image"
  | "video"
  | "audio"
  | "document"
  | "archive"
  | "code"
  | "application"
  | "other";

export interface FileEntry {
  name: string;
  path: string;
  kind: FileKind;
  category: FileCategory;
  extension: string;
  size: number;
  createdAt: number;
  modifiedAt: number;
  accessedAt: number;
  owner: string;
  permissions: string;
  isHidden: boolean;
  isReadonly: boolean;
  isExecutable: boolean;
  /** Only present for directories when cheaply available. */
  childCount?: number;
}

export interface DirListing {
  path: string;
  parent: string | null;
  entries: FileEntry[];
  truncated: boolean;
  error?: string;
}

export interface DriveInfo {
  name: string;
  mountPath: string;
  filesystem: string;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
  usedPercent: number;
  isReadonly: boolean;
  isRoot: boolean;
  isExternal: boolean;
  kind: "internal" | "external" | "network" | "system";
  /** SMART status from diskutil ("Verified", "Failing", …); null when unavailable. */
  smartStatus: string | null;
  /** True for SSDs, false for HDDs, null when diskutil doesn't report it. */
  isSolidState: boolean | null;
}

export interface QuickLocation {
  label: string;
  path: string;
  icon: string;
}

export type SearchMode = "contains" | "startsWith" | "endsWith" | "regex" | "fuzzy";

export interface SearchRequest {
  root: string;
  query: string;
  mode: SearchMode;
  caseSensitive: boolean;
  includeHidden: boolean;
  extensions?: string[];
  maxResults?: number;
}

export interface SearchResponse {
  results: FileEntry[];
  visited: number;
  truncated: boolean;
  elapsedMs: number;
}

export type DevFolderCategory = "dependencies" | "build" | "cache" | "venv";

export interface ScanDevFolderStat {
  path: string;
  /** The dev folder's own name, e.g. "node_modules". */
  name: string;
  /** Name of the enclosing project directory, for display. */
  projectName: string;
  category: DevFolderCategory;
  bytes: number;
  files: number;
  modifiedAt: number;
}

export interface ScanDevSummary {
  category: DevFolderCategory;
  bytes: number;
  files: number;
  folders: number;
}

export type ScanState = "idle" | "running" | "paused" | "done" | "cancelled" | "error";

export type ScanMode = "full" | "rescan";

export interface ScanCategoryStat {
  category: FileCategory;
  files: number;
  bytes: number;
}

export interface ScanFolderStat {
  path: string;
  bytes: number;
  files: number;
}

export interface ScanFileStat {
  path: string;
  name: string;
  bytes: number;
  extension: string;
  category: FileCategory;
  modifiedAt: number;
}

export interface ScanProgress {
  state: ScanState;
  mode: ScanMode;
  root: string | null;
  filesScanned: number;
  foldersScanned: number;
  /** Folders reused from the stored index unchanged during a rescan (not re-walked). */
  foldersReused: number;
  bytesScanned: number;
  errors: number;
  skipped: number;
  currentPath: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  elapsedMs: number;
  filesPerSecond: number;
  hiddenFiles: number;
  symlinks: number;
}

export interface ScanResult {
  progress: ScanProgress;
  categories: ScanCategoryStat[];
  largestFolders: ScanFolderStat[];
  largestFiles: ScanFileStat[];
  averageFileSize: number;
  oldestFile: ScanFileStat | null;
  newestFile: ScanFileStat | null;
  /** Developer folders (node_modules, build output, caches, venvs) found anywhere in the tree, largest first. */
  devFolders: ScanDevFolderStat[];
  /** Totals per developer-folder category across the whole scan. */
  devSummary: ScanDevSummary[];
  /** Set when the result was restored from the database rather than memory. */
  savedAt?: number;
}

export interface ApiError {
  code: string;
  message: string;
}

export type DuplicateState = "idle" | "running" | "done" | "cancelled" | "error";

export interface DuplicateGroup {
  /** Content hash shared by every file in the group ("partial:"-prefixed when only sampled). */
  hash: string;
  bytes: number;
  files: string[];
}

export interface DuplicateProgress {
  state: DuplicateState;
  root: string | null;
  minSize: number;
  filesConsidered: number;
  filesHashed: number;
  bytesHashed: number;
  groupsFound: number;
  wastedBytes: number;
  truncated: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  elapsedMs: number;
}

export interface DuplicateResult {
  progress: DuplicateProgress;
  groups: DuplicateGroup[];
  /** Set when the result was restored from the database rather than memory. */
  savedAt?: number;
}

export interface BatteryInfo {
  present: boolean;
  /** Current charge level, 0-100. */
  percentage: number;
  cycleCount: number;
  /** Max capacity vs. design capacity, 0-100. */
  health: number;
  isCharging: boolean;
  isPluggedIn: boolean;
  isFullyCharged: boolean;
  timeToEmptyMinutes: number | null;
  timeToFullMinutes: number | null;
  designCapacity: number;
  maxCapacity: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  root: string;
  query: string;
  mode: SearchMode;
  caseSensitive: boolean;
  includeHidden: boolean;
}
