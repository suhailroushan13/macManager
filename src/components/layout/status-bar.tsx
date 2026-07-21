"use client";

import { useDrives, useScanResult } from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatCount, formatDate, formatPercent } from "@/lib/format";

export function StatusBar() {
  const { data: drives } = useDrives();
  const { data: scan } = useScanResult();
  const unitSystem = useSettingsStore((state) => state.unitSystem);

  const rootDrive = drives?.find((drive) => drive.isRoot) ?? drives?.[0];
  const progress = scan?.progress;
  const isScanning = progress?.state === "running" || progress?.state === "paused";

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t bg-background px-4 text-[11px] text-muted-foreground">
      {rootDrive && (
        <span className="tabular-nums">
          {rootDrive.name}: {formatBytes(rootDrive.usedBytes, unitSystem)} of{" "}
          {formatBytes(rootDrive.totalBytes, unitSystem)} used ({formatPercent(rootDrive.usedPercent)})
        </span>
      )}
      {isScanning && progress && (
        <span className="tabular-nums" aria-live="polite">
          Scanning {formatCount(progress.filesScanned)} files · {formatCount(progress.filesPerSecond)}/s
          {progress.currentPath ? ` · ${progress.currentPath}` : ""}
        </span>
      )}
      {!isScanning && progress?.state === "done" && (
        <span className="tabular-nums">
          Last scan: {formatCount(progress.filesScanned)} files, {formatCount(progress.foldersScanned)} folders
          {progress.finishedAt ? ` · ${formatDate(progress.finishedAt)}` : ""}
          {scan?.savedAt ? " · restored" : ""}
        </span>
      )}
      <span className="ml-auto">{drives ? `${drives.length} drives` : ""}</span>
    </footer>
  );
}
