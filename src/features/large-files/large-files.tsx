"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ScanSearch, X } from "lucide-react";
import type { FileCategory, ScanFileStat } from "@/types/fs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useFileOperation, useScanResult, useStartScan } from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatDate } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/file-category";

const LIMITS = [100, 500, 1000] as const;

function LargeFileRow({ file, rank }: { file: ScanFileStat; rank: number }) {
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const fileOperation = useFileOperation();

  const copyPath = async () => {
    await navigator.clipboard.writeText(file.path);
    toast.success("Path copied");
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_6rem_7rem_9rem] items-center gap-3 border-b px-3 py-2 text-xs transition-colors hover:bg-muted/60">
          <span className="text-muted-foreground tabular-nums">{rank}</span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{file.name}</span>
            <span className="block truncate font-mono text-[10px] text-muted-foreground">{file.path}</span>
          </span>
          <span className="font-medium tabular-nums">{formatBytes(file.bytes, unitSystem)}</span>
          <span className="text-muted-foreground">{CATEGORY_LABELS[file.category]}</span>
          <span className="text-muted-foreground tabular-nums">{formatDate(file.modifiedAt)}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => fileOperation.mutate({ action: "open", paths: [file.path] })}>
          Open
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => fileOperation.mutate({ action: "reveal", paths: [file.path] })}>
          Reveal in Finder
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void copyPath()}>Copy path</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => fileOperation.mutate({ action: "trash", paths: [file.path] })}
        >
          Move to Trash
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function LargeFiles() {
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(100);
  const { data: scan, isLoading } = useScanResult();
  const startScan = useStartScan();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get("category");
  const category = categoryParam && categoryParam in CATEGORY_LABELS ? (categoryParam as FileCategory) : null;

  const progress = scan?.progress;
  const isScanning = progress?.state === "running" || progress?.state === "paused";
  const files = useMemo(() => {
    const allFiles = scan?.largestFiles ?? [];
    const filtered = category ? allFiles.filter((file) => file.category === category) : allFiles;
    return filtered.slice(0, limit);
  }, [scan, category, limit]);

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            {category ? `${CATEGORY_LABELS[category]}` : "Large Files"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {category
              ? `${CATEGORY_LABELS[category]} files from the last scan, largest first.`
              : "The biggest files found by the last disk scan."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {category && (
            <Button variant="ghost" size="sm" className="gap-1" onClick={() => router.push("/large-files")}>
              <X className="size-3.5" aria-hidden /> Clear filter
            </Button>
          )}
          <Tabs value={String(limit)} onValueChange={(value) => setLimit(Number(value) as (typeof LIMITS)[number])}>
            <TabsList>
              {LIMITS.map((option) => (
                <TabsTrigger key={option} value={String(option)}>
                  Top {option}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : files.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          {isScanning ? (
            <>
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Scan in progress…</p>
              <p className="text-xs text-muted-foreground">Large files will appear as the scan completes.</p>
            </>
          ) : (
            <>
              <ScanSearch className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No scan data yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Run a disk scan to find the files taking up the most space.
              </p>
              <Button size="sm" onClick={() => startScan.mutate("/")} disabled={startScan.isPending}>
                Scan startup disk
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border">
          <div className="sticky top-0 z-10 grid grid-cols-[2.5rem_minmax(0,1fr)_6rem_7rem_9rem] gap-3 border-b bg-muted/80 px-3 py-2 text-[11px] font-medium text-muted-foreground backdrop-blur">
            <span>#</span>
            <span>File</span>
            <span>Size</span>
            <span>Type</span>
            <span>Modified</span>
          </div>
          {files.map((file, index) => (
            <LargeFileRow key={file.path} file={file} rank={index + 1} />
          ))}
          {isScanning && (
            <div className="p-3">
              <Badge variant="secondary" className="gap-1.5">
                <Loader2 className="size-3 animate-spin" aria-hidden /> Still scanning — list updates live
              </Badge>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
