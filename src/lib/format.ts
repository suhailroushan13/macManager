export type UnitSystem = "binary" | "decimal";

const BINARY_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"] as const;
const DECIMAL_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export function formatBytes(bytes: number, system: UnitSystem = "decimal"): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const base = system === "binary" ? 1024 : 1000;
  const units = system === "binary" ? BINARY_UNITS : DECIMAL_UNITS;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(base)), units.length - 1);
  const value = bytes / base ** exponent;
  const digits = value >= 100 || exponent === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[exponent]}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatPercent(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  return `${Math.round(fraction * 100)}%`;
}

export function formatDate(epochMs: number): string {
  if (!epochMs) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(epochMs));
}

export function formatMinutes(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  if (hours === 0) return `${remainder}m`;
  return `${hours}h ${remainder}m`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
