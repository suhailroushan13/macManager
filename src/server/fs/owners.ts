import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ownerCache = new Map<number, string>();

/** Resolves a uid to a username, caching results for the process lifetime. */
export async function ownerName(uid: number): Promise<string> {
  const cached = ownerCache.get(uid);
  if (cached) return cached;
  let name = String(uid);
  try {
    const { stdout } = await execFileAsync("id", ["-nu", String(uid)], { timeout: 2000 });
    const trimmed = stdout.trim();
    if (trimmed) name = trimmed;
  } catch {
    // Unknown uid — fall back to the numeric id; not worth failing a listing over.
  }
  ownerCache.set(uid, name);
  return name;
}
