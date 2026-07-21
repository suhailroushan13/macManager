import { describe, expect, it } from "vitest";
import { buildScanReport, toCsv } from "./export";
import type { ScanResult } from "@/types/fs";

const sampleResult: ScanResult = {
  progress: {
    state: "done",
    mode: "full",
    root: "/Users/test",
    filesScanned: 10,
    foldersScanned: 3,
    foldersReused: 0,
    bytesScanned: 5000,
    errors: 0,
    skipped: 0,
    currentPath: null,
    startedAt: 0,
    finishedAt: 1000,
    elapsedMs: 1000,
    filesPerSecond: 10,
    hiddenFiles: 1,
    symlinks: 0,
  },
  categories: [{ category: "image", files: 4, bytes: 3000 }],
  largestFolders: [{ path: "/Users/test/Photos", bytes: 3000, files: 4 }],
  largestFiles: [
    { path: "/Users/test/Photos/a.png", name: "a.png", bytes: 2000, extension: "png", category: "image", modifiedAt: 0 },
  ],
  averageFileSize: 500,
  oldestFile: null,
  newestFile: null,
  devFolders: [],
  devSummary: [],
};

describe("toCsv", () => {
  it("escapes quotes, commas, and newlines", () => {
    expect(toCsv(["a", "b"], [['x,"y"', "line\nbreak"]])).toBe('a,b\n"x,""y""","line\nbreak"');
  });
});

describe("buildScanReport", () => {
  it("produces JSON that round-trips", () => {
    const report = buildScanReport(sampleResult, "json", "decimal");
    expect(report.extension).toBe("json");
    expect(JSON.parse(report.content)).toEqual(sampleResult);
  });

  it("produces CSV with category, folder, and file sections", () => {
    const report = buildScanReport(sampleResult, "csv", "decimal");
    expect(report.content).toContain("Category,Files,Size");
    expect(report.content).toContain("/Users/test/Photos");
    expect(report.content).toContain("a.png");
  });

  it("produces Markdown with headings and tables", () => {
    const report = buildScanReport(sampleResult, "markdown", "decimal");
    expect(report.content).toContain("# Disk Scan Report");
    expect(report.content).toContain("| Category | Files | Size |");
    expect(report.content).toContain("**Root**: /Users/test");
  });
});
