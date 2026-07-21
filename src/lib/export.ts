import type { ScanResult } from "@/types/fs";
import { formatBytes, formatDate, type UnitSystem } from "./format";
import { CATEGORY_LABELS } from "./file-category";

export type ExportFormat = "csv" | "json" | "markdown";

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
}

function toMarkdownTable(headers: string[], rows: string[][]): string {
  const escape = (value: string) => value.replaceAll("|", "\\|");
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
}

/** Serializes the last scan into a downloadable report. */
export function buildScanReport(result: ScanResult, format: ExportFormat, unitSystem: UnitSystem): {
  content: string;
  mime: string;
  extension: string;
} {
  if (format === "json") {
    return { content: JSON.stringify(result, null, 2), mime: "application/json", extension: "json" };
  }

  const fileHeaders = ["Rank", "File", "Size", "Type", "Modified"];
  const fileRows = result.largestFiles.slice(0, 100).map((file, index) => [
    String(index + 1),
    file.path,
    formatBytes(file.bytes, unitSystem),
    CATEGORY_LABELS[file.category],
    formatDate(file.modifiedAt),
  ]);
  const folderHeaders = ["Folder", "Size", "Files"];
  const folderRows = result.largestFolders.map((folder) => [
    folder.path,
    formatBytes(folder.bytes, unitSystem),
    String(folder.files),
  ]);
  const categoryHeaders = ["Category", "Files", "Size"];
  const categoryRows = result.categories.map((category) => [
    CATEGORY_LABELS[category.category],
    String(category.files),
    formatBytes(category.bytes, unitSystem),
  ]);

  if (format === "csv") {
    const sections = [
      toCsv(categoryHeaders, categoryRows),
      toCsv(folderHeaders, folderRows),
      toCsv(fileHeaders, fileRows),
    ];
    return { content: sections.join("\n\n"), mime: "text/csv", extension: "csv" };
  }

  const { progress } = result;
  const content = [
    `# Disk Scan Report`,
    ``,
    `- **Root**: ${progress.root ?? "—"}`,
    `- **Scanned**: ${progress.filesScanned.toLocaleString()} files, ${progress.foldersScanned.toLocaleString()} folders`,
    `- **Total size**: ${formatBytes(progress.bytesScanned, unitSystem)}`,
    `- **Errors**: ${progress.errors} · **Skipped**: ${progress.skipped}`,
    ``,
    `## File Types`,
    ``,
    toMarkdownTable(categoryHeaders, categoryRows),
    ``,
    `## Largest Folders`,
    ``,
    toMarkdownTable(folderHeaders, folderRows),
    ``,
    `## Largest Files (top 100)`,
    ``,
    toMarkdownTable(fileHeaders, fileRows),
    ``,
  ].join("\n");
  return { content, mime: "text/markdown", extension: "md" };
}

/** Triggers a client-side download of generated content. */
export function downloadContent(fileName: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
