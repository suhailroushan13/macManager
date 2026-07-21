import { describe, expect, it } from "vitest";
import { formatBytes, formatCount, formatDuration, formatPercent } from "./format";

describe("formatBytes", () => {
  it("formats zero and invalid values", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });

  it("formats decimal units", () => {
    expect(formatBytes(1000)).toBe("1.00 KB");
    expect(formatBytes(1_500_000)).toBe("1.50 MB");
    expect(formatBytes(994_662_584_320)).toBe("995 GB");
  });

  it("formats binary units", () => {
    expect(formatBytes(1024, "binary")).toBe("1.00 KiB");
    expect(formatBytes(1024 ** 3, "binary")).toBe("1.00 GiB");
  });

  it("scales precision with magnitude", () => {
    expect(formatBytes(123)).toBe("123 B");
    expect(formatBytes(12_300)).toBe("12.3 KB");
    expect(formatBytes(123_000)).toBe("123 KB");
  });
});

describe("formatPercent", () => {
  it("rounds fractions", () => {
    expect(formatPercent(0.851)).toBe("85%");
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(Number.NaN)).toBe("—");
  });
});

describe("formatCount", () => {
  it("adds thousands separators", () => {
    expect(formatCount(2431932)).toBe("2,431,932");
  });
});

describe("formatDuration", () => {
  it("formats seconds, minutes, and hours", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(90_000)).toBe("1m 30s");
    expect(formatDuration(3_720_000)).toBe("1h 2m");
    expect(formatDuration(-1)).toBe("—");
  });
});
