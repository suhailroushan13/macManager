"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, ScanSearch } from "lucide-react";
import type { DevFolderCategory, ScanDevFolderStat } from "@/types/fs";
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
import { formatBytes, formatCount, formatDate } from "@/lib/format";
import { DEV_FOLDER_LABELS, LARGE_DEPENDENCY_WARNING_BYTES } from "@/lib/dev-folders";

type SortDirection = "asc" | "desc";
type CategoryFilter = "all" | DevFolderCategory;

const CATEGORY_TABS: CategoryFilter[] = ["all", "dependencies", "build", "cache", "venv"];

function DevFolderRow({ folder }: { folder: ScanDevFolderStat }) {
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const fileOperation = useFileOperation();
  const isLarge = folder.category === "dependencies" && folder.bytes >= LARGE_DEPENDENCY_WARNING_BYTES;

  const copyPath = async () => {
    await navigator.clipboard.writeText(folder.path);
    toast.success("Path copied");
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_5.5rem_7rem_5.5rem_9rem] items-center gap-3 border-b px-3 py-2 text-xs transition-colors hover:bg-muted/60">
          <span className="min-w-0 truncate font-medium">{folder.projectName || "—"}</span>
          <span className="min-w-0 truncate font-mono text-[10px] text-muted-foreground">{folder.path}</span>
          <span className="flex items-center gap-1.5 font-medium tabular-nums">
            {formatBytes(folder.bytes, unitSystem)}
            {isLarge && (
              <Badge variant="outline" className="border-amber-500/40 text-[9px] text-amber-500">
                Large
              </Badge>
            )}
          </span>
          <span className="text-muted-foreground tabular-nums">{formatCount(folder.files)} files</span>
          <span className="text-muted-foreground">{DEV_FOLDER_LABELS[folder.category]}</span>
          <span className="text-muted-foreground tabular-nums">{formatDate(folder.modifiedAt)}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onSelect={() => fileOperation.mutate({ action: "reveal", paths: [folder.path] })}>
          Reveal in Finder
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => fileOperation.mutate({ action: "terminal", paths: [folder.path] })}>
          Open in Terminal
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => void copyPath()}>Copy path</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          variant="destructive"
          onSelect={() => fileOperation.mutate({ action: "trash", paths: [folder.path] })}
        >
          Move to Trash
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export function DeveloperFolders() {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const { data: scan, isLoading } = useScanResult();
  const startScan = useStartScan();

  const progress = scan?.progress;
  const isScanning = progress?.state === "running" || progress?.state === "paused";

  const folders = useMemo(() => {
    const all = scan?.devFolders ?? [];
    const filtered = category === "all" ? all : all.filter((folder) => folder.category === category);
    const sorted = [...filtered].sort((a, b) => (sortDirection === "desc" ? b.bytes - a.bytes : a.bytes - b.bytes));
    return sorted;
  }, [scan, category, sortDirection]);

  return (
    <div className="mx-auto flex h-full max-w-6xl flex-col p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Developer Folders</h1>
          <p className="text-sm text-muted-foreground">
            node_modules, build output, caches, and virtual environments — never excluded from scanning, only from this view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={category} onValueChange={(value) => setCategory(value as CategoryFilter)}>
            <TabsList>
              {CATEGORY_TABS.map((tab) => (
                <TabsTrigger key={tab} value={tab}>
                  {tab === "all" ? "All" : DEV_FOLDER_LABELS[tab]}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortDirection((direction) => (direction === "desc" ? "asc" : "desc"))}
          >
            {sortDirection === "desc" ? <ArrowDown className="size-4" aria-hidden /> : <ArrowUp className="size-4" aria-hidden />}
            Size
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : folders.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed py-16 text-center">
          {isScanning ? (
            <>
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">Scan in progress…</p>
              <p className="text-xs text-muted-foreground">Developer folders will appear as the scan completes.</p>
            </>
          ) : (
            <>
              <ScanSearch className="size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-medium">No scan data yet</p>
              <p className="max-w-sm text-xs text-muted-foreground">
                Run a disk scan to find node_modules, build output, caches, and virtual environments.
              </p>
              <Button size="sm" onClick={() => startScan.mutate("/")} disabled={startScan.isPending}>
                Scan startup disk
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border">
          <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)_5.5rem_7rem_5.5rem_9rem] gap-3 border-b bg-muted/80 px-3 py-2 text-[11px] font-medium text-muted-foreground backdrop-blur">
            <span>Project</span>
            <span>Full Path</span>
            <span>Size</span>
            <span>Files</span>
            <span>Type</span>
            <span>Modified</span>
          </div>
          {folders.map((folder) => (
            <DevFolderRow key={folder.path} folder={folder} />
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
