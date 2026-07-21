import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { DriveInfo } from "@/types/fs";

const execFileAsync = promisify(execFile);

const HIDDEN_MOUNT_PREFIXES = ["/System/Volumes/", "/private/var/vm", "/dev", "/Library/Developer"];
const NETWORK_FILESYSTEMS = new Set(["smbfs", "afpfs", "nfs", "webdav", "cifs"]);

interface MountFlags {
  filesystem: string;
  readonly: boolean;
}

interface DiskHealth {
  smartStatus: string | null;
  isSolidState: boolean | null;
}

const healthCache = new Map<string, { value: DiskHealth; fetchedAt: number }>();
const HEALTH_CACHE_TTL_MS = 5 * 60_000;

/** Reads SMART status and media type from `diskutil info`, cached per device. */
async function readDiskHealth(device: string): Promise<DiskHealth> {
  if (!device.startsWith("/dev/")) return { smartStatus: null, isSolidState: null };
  const cached = healthCache.get(device);
  if (cached && Date.now() - cached.fetchedAt < HEALTH_CACHE_TTL_MS) return cached.value;

  let value: DiskHealth = { smartStatus: null, isSolidState: null };
  try {
    const { stdout } = await execFileAsync("diskutil", ["info", device], { timeout: 8000 });
    const smartMatch = stdout.match(/SMART Status:\s+(.+)/);
    const solidStateMatch = stdout.match(/Solid State:\s+(Yes|No)/);
    let smartStatus = smartMatch ? smartMatch[1].trim() : null;

    // Synthesized APFS devices report "Not Supported"; the physical store
    // underneath carries the real SMART verdict.
    const physicalStoreMatch = stdout.match(/APFS Physical Store:\s+(\S+)/);
    if (smartStatus === "Not Supported" && physicalStoreMatch) {
      const { stdout: physicalInfo } = await execFileAsync(
        "diskutil",
        ["info", `/dev/${physicalStoreMatch[1]}`],
        { timeout: 8000 },
      );
      const physicalSmart = physicalInfo.match(/SMART Status:\s+(.+)/);
      if (physicalSmart) smartStatus = physicalSmart[1].trim();
    }

    value = {
      smartStatus,
      isSolidState: solidStateMatch ? solidStateMatch[1] === "Yes" : null,
    };
  } catch {
    // diskutil unavailable (non-macOS) or unknown device — health stays unknown.
  }
  healthCache.set(device, { value, fetchedAt: Date.now() });
  return value;
}

async function readMountFlags(): Promise<Map<string, MountFlags>> {
  const flags = new Map<string, MountFlags>();
  try {
    const { stdout } = await execFileAsync("mount", [], { timeout: 5000 });
    // Lines look like: /dev/disk3s5 on /System/Volumes/Data (apfs, local, journaled)
    for (const line of stdout.split("\n")) {
      const match = line.match(/ on (.+) \(([^)]+)\)$/);
      if (!match) continue;
      const mountPath = match[1];
      const options = match[2].split(",").map((option) => option.trim());
      flags.set(mountPath, {
        filesystem: options[0] ?? "unknown",
        // The sealed APFS system volume reports read-only, but its paired Data
        // volume is writable — treat the root as writable like Finder does.
        readonly: mountPath !== "/" && options.includes("read-only"),
      });
    }
  } catch {
    // mount(8) unavailable — filesystem/readonly fall back to defaults below.
  }
  return flags;
}

function driveKind(mountPath: string, filesystem: string): DriveInfo["kind"] {
  if (NETWORK_FILESYSTEMS.has(filesystem)) return "network";
  if (mountPath.startsWith("/Volumes/")) return "external";
  if (mountPath === "/") return "internal";
  return "system";
}

function driveName(mountPath: string): string {
  if (mountPath === "/") return "Macintosh HD";
  const segments = mountPath.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? mountPath;
}

/** Enumerates mounted drives via `df` + `mount`, filtered to user-relevant volumes. */
export async function listDrives(): Promise<DriveInfo[]> {
  const [{ stdout }, mountFlags] = await Promise.all([
    execFileAsync("df", ["-kP"], { timeout: 5000 }),
    readMountFlags(),
  ]);

  const drives: DriveInfo[] = [];
  const lines = stdout.trim().split("\n").slice(1);
  for (const line of lines) {
    const columns = line.split(/\s+/);
    if (columns.length < 6) continue;
    const device = columns[0];
    const mountPath = columns.slice(5).join(" ");
    if (HIDDEN_MOUNT_PREFIXES.some((prefix) => mountPath.startsWith(prefix))) continue;
    if (device === "devfs" || device === "map auto_home") continue;

    const totalBytes = Number(columns[1]) * 1024;
    const freeBytes = Number(columns[3]) * 1024;
    if (!Number.isFinite(totalBytes) || totalBytes === 0) continue;
    // On APFS the per-volume "used" column excludes sibling volumes in the same
    // container; total − free matches what Finder reports for the whole disk.
    const usedBytes = Math.max(totalBytes - freeBytes, 0);

    const flags = mountFlags.get(mountPath);
    const filesystem = flags?.filesystem ?? "unknown";
    const health = await readDiskHealth(device);
    drives.push({
      name: driveName(mountPath),
      mountPath,
      filesystem,
      totalBytes,
      usedBytes,
      freeBytes,
      usedPercent: usedBytes / totalBytes,
      isReadonly: flags?.readonly ?? false,
      isRoot: mountPath === "/",
      isExternal: mountPath.startsWith("/Volumes/"),
      kind: driveKind(mountPath, filesystem),
      smartStatus: health.smartStatus,
      isSolidState: health.isSolidState,
    });
  }

  // Root first, then largest first — stable, predictable ordering for the UI.
  return drives.sort((a, b) => Number(b.isRoot) - Number(a.isRoot) || b.totalBytes - a.totalBytes);
}
