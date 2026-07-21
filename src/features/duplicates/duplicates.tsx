"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, RefreshCw, X } from "lucide-react";
import type { DuplicateGroup } from "@/types/fs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useCancelDuplicates,
  useDuplicateResult,
  useFileOperation,
  useQuickLocations,
  useStartDuplicates,
} from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatCount, formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

const MIN_SIZE_OPTIONS = [
  { label: "≥ 100 KB", value: 100 * 1024 },
  { label: "≥ 1 MB", value: 1024 * 1024 },
  { label: "≥ 10 MB", value: 10 * 1024 * 1024 },
  { label: "≥ 100 MB", value: 100 * 1024 * 1024 },
];

function GroupCard({
  group,
  selected,
  onToggle,
}: {
  group: DuplicateGroup;
  selected: Set<string>;
  onToggle: (path: string) => void;
}) {
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const isPartial = group.hash.startsWith("partial:");
  const wasted = (group.files.length - 1) * group.bytes;

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-medium">
            {group.files.length} copies · {formatBytes(group.bytes, unitSystem)} each
          </span>
          <Badge variant="secondary" className="text-[10px] tabular-nums">
            {formatBytes(wasted, unitSystem)} reclaimable
          </Badge>
          {isPartial && (
            <Badge variant="outline" className="text-[10px]">
              sampled match
            </Badge>
          )}
        </div>
        <ul className="space-y-1">
          {group.files.map((filePath) => (
            <li key={filePath} className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={selected.has(filePath)}
                onCheckedChange={() => onToggle(filePath)}
                aria-label={`Select ${filePath}`}
              />
              <span className="truncate font-mono text-[11px]">{filePath}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function Duplicates() {
  const { data: locations } = useQuickLocations();
  const homePath = locations?.find((location) => location.label === "Home")?.path ?? "";
  const [root, setRoot] = useState("");
  const [minSize, setMinSize] = useState(1024 * 1024);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isConfirmingTrash, setIsConfirmingTrash] = useState(false);

  const { data, isFetching, refetch } = useDuplicateResult();
  const startDuplicates = useStartDuplicates();
  const cancelDuplicates = useCancelDuplicates();
  const fileOperation = useFileOperation();
  const unitSystem = useSettingsStore((state) => state.unitSystem);

  const progress = data?.progress;
  const isRunning = progress?.state === "running";
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const effectiveRoot = root.trim() || homePath;

  const toggleSelected = (path: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const selectAllButFirst = () => {
    const next = new Set<string>();
    for (const group of groups) {
      for (const filePath of group.files.slice(1)) next.add(filePath);
    }
    setSelected(next);
    toast.success(`Selected ${formatCount(next.size)} redundant copies`);
  };

  const confirmTrash = () => {
    fileOperation.mutate({ action: "trash", paths: [...selected].slice(0, 100) });
    setSelected(new Set());
    setIsConfirmingTrash(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Duplicate Finder</h1>
          <p className="text-sm text-muted-foreground">
            Finds files with identical content by size and hash, grouped so you can reclaim space.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden />
          Refresh
        </Button>
      </div>

      <Card className="rounded-2xl">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-64 flex-1 space-y-1.5">
            <Label htmlFor="duplicate-root">Folder to scan</Label>
            <Input
              id="duplicate-root"
              value={root}
              onChange={(event) => setRoot(event.target.value)}
              placeholder={homePath || "/absolute/path"}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="duplicate-min-size">Minimum size</Label>
            <Select value={String(minSize)} onValueChange={(value) => setMinSize(Number(value))}>
              <SelectTrigger id="duplicate-min-size" className="w-32" aria-label="Minimum file size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MIN_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isRunning ? (
            <Button variant="outline" onClick={() => cancelDuplicates.mutate()}>
              <X className="size-4" aria-hidden /> Cancel
            </Button>
          ) : (
            <Button
              onClick={() => startDuplicates.mutate({ root: effectiveRoot, minSize })}
              disabled={!effectiveRoot || startDuplicates.isPending}
            >
              {startDuplicates.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              Find duplicates
            </Button>
          )}
        </CardContent>
      </Card>

      {progress && progress.state !== "idle" && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {isRunning && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          <span className="tabular-nums">
            {isRunning ? "Scanning" : progress.state === "done" ? "Finished" : "Stopped"} ·{" "}
            {formatCount(progress.filesConsidered)} files considered · {formatCount(progress.filesHashed)} hashed ·{" "}
            {formatDuration(progress.elapsedMs)}
          </span>
          {progress.truncated && (
            <Badge variant="outline" className="text-[10px]">
              results truncated
            </Badge>
          )}
          {progress.wastedBytes > 0 && (
            <Badge variant="secondary" className="text-[10px] tabular-nums">
              {formatBytes(progress.wastedBytes, unitSystem)} reclaimable in {progress.groupsFound} groups
            </Badge>
          )}
        </div>
      )}

      {groups.length > 0 && (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={selectAllButFirst}>
            Select all but first copy
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={selected.size === 0}
            onClick={() => setIsConfirmingTrash(true)}
          >
            Move {selected.size > 0 ? formatCount(selected.size) : ""} selected to Trash
          </Button>
        </div>
      )}

      {groups.length === 0 && progress?.state === "done" && (
        <div className="rounded-2xl border border-dashed py-14 text-center">
          <p className="text-sm font-medium">No duplicates found</p>
          <p className="text-xs text-muted-foreground">
            Nothing at or above the size threshold had identical content.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group) => (
          <GroupCard key={group.hash + group.bytes} group={group} selected={selected} onToggle={toggleSelected} />
        ))}
      </div>

      <AlertDialog open={isConfirmingTrash} onOpenChange={setIsConfirmingTrash}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move {formatCount(selected.size)} files to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Selected duplicate copies will be moved to the macOS Trash. You can restore them from there.
              {selected.size > 100 && " Only the first 100 will be trashed in one batch."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTrash}>Move to Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
