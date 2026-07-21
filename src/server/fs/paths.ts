import path from "node:path";
import { stat } from "node:fs/promises";

/**
 * This app intentionally browses the whole local filesystem, so there is no
 * allowlist — but every path from the client is normalized and must be
 * absolute and existing before any service touches it.
 */
export class PathError extends Error {
  constructor(
    readonly code: "INVALID_PATH" | "NOT_FOUND" | "NOT_A_DIRECTORY",
    message: string,
  ) {
    super(message);
  }
}

export function normalizeAbsolute(rawPath: string): string {
  if (typeof rawPath !== "string" || rawPath.length === 0) {
    throw new PathError("INVALID_PATH", "A path is required.");
  }
  const normalized = path.normalize(rawPath);
  if (!path.isAbsolute(normalized) || normalized.includes("\0")) {
    throw new PathError("INVALID_PATH", "Path must be absolute.");
  }
  return normalized;
}

export async function assertDirectory(absolutePath: string): Promise<void> {
  try {
    const info = await stat(absolutePath);
    if (!info.isDirectory()) {
      throw new PathError("NOT_A_DIRECTORY", "Path is not a directory.");
    }
  } catch (error) {
    if (error instanceof PathError) throw error;
    throw new PathError("NOT_FOUND", "Path does not exist or is not readable.");
  }
}
