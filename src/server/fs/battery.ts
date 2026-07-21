import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BatteryInfo } from "@/types/fs";

const execFileAsync = promisify(execFile);

function parseIoregFields(stdout: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of stdout.split("\n")) {
    const match = line.trim().match(/^"([A-Za-z0-9]+)"\s*=\s*(.+)$/);
    if (match) fields[match[1]] = match[2];
  }
  return fields;
}

/**
 * ioreg reports 65535 (or non-positive) when a time estimate isn't available yet, and can
 * report wildly inflated values (700+ hours) right after unplugging before the estimate
 * settles. No consumer laptop battery lasts more than ~24h, so clamp anything past that too.
 */
function parseMinutes(raw: string | undefined): number | null {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0 || value >= 65535 || value > 1440) return null;
  return value;
}

/** Reads battery status from AppleSmartBattery via ioreg; null on desktops without a battery. */
export async function readBattery(): Promise<BatteryInfo | null> {
  let stdout: string;
  try {
    ({ stdout } = await execFileAsync("ioreg", ["-r", "-c", "AppleSmartBattery"], { timeout: 8000 }));
  } catch {
    return null;
  }

  const fields = parseIoregFields(stdout);
  if (!("CurrentCapacity" in fields)) return null;

  const rawMaxCapacity = Number(fields.AppleRawMaxCapacity);
  const designCapacity = Number(fields.DesignCapacity);
  const health =
    Number.isFinite(rawMaxCapacity) && Number.isFinite(designCapacity) && designCapacity > 0
      ? Math.round((rawMaxCapacity / designCapacity) * 100)
      : Number(fields.MaxCapacity) || 100;

  return {
    present: true,
    percentage: Number(fields.CurrentCapacity) || 0,
    cycleCount: Number(fields.CycleCount) || 0,
    health: Math.min(health, 100),
    isCharging: fields.IsCharging === "Yes",
    isPluggedIn: fields.ExternalConnected === "Yes",
    isFullyCharged: fields.FullyCharged === "Yes",
    timeToEmptyMinutes: parseMinutes(fields.AvgTimeToEmpty ?? fields.TimeRemaining),
    timeToFullMinutes: parseMinutes(fields.AvgTimeToFull),
    designCapacity: Number.isFinite(designCapacity) ? designCapacity : 0,
    maxCapacity: Number.isFinite(rawMaxCapacity) ? rawMaxCapacity : 0,
  };
}
