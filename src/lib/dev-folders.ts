import type { DevFolderCategory } from "@/types/fs";

/** Folder names recognized as developer-generated, mapped to their display category. Never used to skip scanning — only for classification and UI filters. */
const DEV_FOLDER_CATEGORIES: Record<string, DevFolderCategory> = {
  node_modules: "dependencies",
  vendor: "dependencies",
  Pods: "dependencies",

  dist: "build",
  build: "build",
  ".next": "build",
  ".nuxt": "build",
  ".output": "build",
  target: "build",
  out: "build",

  ".cache": "cache",
  ".npm": "cache",
  ".pnpm-store": "cache",
  ".yarn-cache": "cache",
  ".turbo": "cache",
  ".parcel-cache": "cache",

  venv: "venv",
  ".venv": "venv",
  virtualenv: "venv",
};

export function classifyDevFolder(name: string): DevFolderCategory | null {
  return DEV_FOLDER_CATEGORIES[name] ?? null;
}

export const DEV_FOLDER_LABELS: Record<DevFolderCategory, string> = {
  dependencies: "Dependencies",
  build: "Build Output",
  cache: "Cache",
  venv: "Virtual Environments",
};

/** Folders above this size get a "large dependency folder" warning in the UI. */
export const LARGE_DEPENDENCY_WARNING_BYTES = 5 * 1024 ** 3;

const GENERATED_FILE_PATTERNS = [/\.map$/, /\.lock$/, /^package-lock\.json$/, /^yarn\.lock$/, /^pnpm-lock\.yaml$/, /^\.DS_Store$/];

/** Used by the "Hide Generated Files" UI filter — never affects scanning. */
export function isGeneratedFile(name: string): boolean {
  return GENERATED_FILE_PATTERNS.some((pattern) => pattern.test(name));
}
