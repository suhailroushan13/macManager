"use client";

import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import type { FileEntry } from "@/types/fs";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { FileIcon } from "./file-icon";
import { useFileOperation } from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatDate } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/file-category";
import { classifyDevFolder, DEV_FOLDER_LABELS, isGeneratedFile, LARGE_DEPENDENCY_WARNING_BYTES } from "@/lib/dev-folders";

const ROW_HEIGHT = 38;
const GRID_TEMPLATE =
  "minmax(240px,1fr) 90px minmax(0,110px) minmax(0,70px) minmax(0,90px) minmax(0,90px) minmax(0,150px)";

const DEV_CATEGORY_FILTER_KEY = {
  dependencies: "hideNodeModules",
  build: "hideBuild",
  cache: "hideCache",
  venv: "hideVenv",
} as const;

interface FileTableProps {
  entries: FileEntry[];
  onOpenDirectory: (path: string) => void;
  onPreview: (entry: FileEntry) => void;
  emptyMessage: string;
}

export function FileTable({ entries, onOpenDirectory, onPreview, emptyMessage }: FileTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [trashTargets, setTrashTargets] = useState<FileEntry[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileOperation = useFileOperation();
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const favorites = useSettingsStore((state) => state.favorites);
  const toggleFavorite = useSettingsStore((state) => state.toggleFavorite);
  const devFilters = useSettingsStore((state) => state.devFilters);

  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (entry.kind === "directory") {
          const devCategory = classifyDevFolder(entry.name);
          if (devCategory) return !devFilters[DEV_CATEGORY_FILTER_KEY[devCategory]];
        } else if (devFilters.hideGenerated && isGeneratedFile(entry.name)) {
          return false;
        }
        return true;
      }),
    [entries, devFilters],
  );

  const columns = useMemo<ColumnDef<FileEntry>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: "Name",
        sortingFn: (a, b) =>
          a.original.name.localeCompare(b.original.name, undefined, { numeric: true, sensitivity: "base" }),
        cell: ({ row }) => {
          const devCategory = row.original.kind === "directory" ? classifyDevFolder(row.original.name) : null;
          const isLargeDependency =
            devCategory === "dependencies" && row.original.size >= LARGE_DEPENDENCY_WARNING_BYTES;
          return (
            <span className="flex min-w-0 items-center gap-2">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(checked) => row.toggleSelected(checked === true)}
                onClick={(event) => event.stopPropagation()}
                aria-label={`Select ${row.original.name}`}
              />
              <FileIcon entry={row.original} />
              <span className={cn("truncate", row.original.isHidden && "text-muted-foreground")}>
                {row.original.name}
              </span>
              {devCategory && (
                <Badge variant="outline" className="shrink-0 font-normal text-[10px]">
                  {DEV_FOLDER_LABELS[devCategory]}
                </Badge>
              )}
              {isLargeDependency && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <AlertTriangle className="size-3.5 shrink-0 text-amber-500" aria-label="Large dependency folder" />
                  </TooltipTrigger>
                  <TooltipContent>
                    Large dependency folder detected ({formatBytes(row.original.size, unitSystem)}). This project&apos;s{" "}
                    {row.original.name} is consuming significant storage.
                  </TooltipContent>
                </Tooltip>
              )}
            </span>
          );
        },
      },
      {
        id: "size",
        accessorKey: "size",
        header: "Size",
        cell: ({ row }) =>
          row.original.kind === "directory" && row.original.size === 0 ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <span className="tabular-nums">{formatBytes(row.original.size, unitSystem)}</span>
          ),
      },
      {
        id: "category",
        accessorKey: "category",
        header: "Type",
        cell: ({ row }) =>
          row.original.kind === "directory" ? "Folder" : CATEGORY_LABELS[row.original.category],
      },
      { id: "extension", accessorKey: "extension", header: "Ext" },
      { id: "owner", accessorKey: "owner", header: "Owner" },
      {
        id: "permissions",
        accessorKey: "permissions",
        header: "Perms",
        cell: ({ row }) => <span className="font-mono text-[11px]">{row.original.permissions}</span>,
      },
      {
        id: "modifiedAt",
        accessorKey: "modifiedAt",
        header: "Modified",
        cell: ({ row }) => <span className="tabular-nums">{formatDate(row.original.modifiedAt)}</span>,
      },
    ],
    [unitSystem],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table is intentionally excluded from React Compiler memoization.
  const table = useReactTable({
    data: visibleEntries,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (entry) => entry.path,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection: true,
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const selectedEntries = table.getSelectedRowModel().rows.map((row) => row.original);

  const handleActivate = (entry: FileEntry) => {
    if (entry.kind === "directory") onOpenDirectory(entry.path);
    else onPreview(entry);
  };

  const copyPath = async (path: string) => {
    await navigator.clipboard.writeText(path);
    toast.success("Path copied");
  };

  const beginRename = (entry: FileEntry) => {
    setRenameTarget(entry);
    setRenameValue(entry.name);
  };

  const submitRename = () => {
    if (!renameTarget || !renameValue.trim()) return;
    fileOperation.mutate({ action: "rename", paths: [renameTarget.path], newName: renameValue.trim() });
    setRenameTarget(null);
  };

  const confirmTrash = () => {
    if (trashTargets.length === 0) return;
    fileOperation.mutate({ action: "trash", paths: trashTargets.map((entry) => entry.path) });
    setTrashTargets([]);
    setRowSelection({});
  };

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 py-16 text-center">
        <p className="text-sm font-medium">Nothing here</p>
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  if (visibleEntries.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 py-16 text-center">
        <p className="text-sm font-medium">Everything here is hidden</p>
        <p className="text-xs text-muted-foreground">Adjust the developer folder filters in Settings to show items.</p>
      </div>
    );
  }

  const renderRow = (row: Row<FileEntry>, virtualStart: number) => {
    const entry = row.original;
    const isFavorite = favorites.includes(entry.path);
    return (
      <ContextMenu key={row.id}>
        <ContextMenuTrigger asChild>
          <div
            role="row"
            tabIndex={0}
            aria-selected={row.getIsSelected()}
            onClick={() => row.toggleSelected()}
            onDoubleClick={() => handleActivate(entry)}
            onKeyDown={(event) => {
              if (event.key === "Enter") handleActivate(entry);
              if (event.key === " ") {
                event.preventDefault();
                row.toggleSelected();
              }
            }}
            className={cn(
              "absolute left-0 top-0 grid w-full cursor-default select-none items-center gap-3 border-b px-3 text-xs outline-none transition-colors",
              "hover:bg-muted/60 focus-visible:bg-muted/60",
              row.getIsSelected() && "bg-accent",
            )}
            style={{
              gridTemplateColumns: GRID_TEMPLATE,
              height: ROW_HEIGHT,
              transform: `translateY(${virtualStart}px)`,
            }}
          >
            {row.getVisibleCells().map((cell) => (
              <div key={cell.id} role="cell" className="min-w-0 truncate">
                {cell.column.columnDef.cell
                  ? flexRender(cell.column.columnDef.cell, cell.getContext())
                  : String(cell.getValue() ?? "")}
              </div>
            ))}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={() => handleActivate(entry)}>
            {entry.kind === "directory" ? "Open folder" : "Preview"}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => fileOperation.mutate({ action: "open", paths: [entry.path] })}>
            Open with default app
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => fileOperation.mutate({ action: "reveal", paths: [entry.path] })}>
            Reveal in Finder
          </ContextMenuItem>
          {entry.kind === "directory" && (
            <ContextMenuItem onSelect={() => fileOperation.mutate({ action: "terminal", paths: [entry.path] })}>
              Open in Terminal
            </ContextMenuItem>
          )}
          <ContextMenuSeparator />
          <ContextMenuItem onSelect={() => void copyPath(entry.path)}>Copy path</ContextMenuItem>
          {entry.kind === "directory" && (
            <ContextMenuItem onSelect={() => toggleFavorite(entry.path)}>
              {isFavorite ? "Remove from favorites" : "Add to favorites"}
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => beginRename(entry)}>Rename…</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onSelect={() => setTrashTargets(selectedEntries.length > 1 ? selectedEntries : [entry])}
          >
            Move to Trash
            {selectedEntries.length > 1 ? ` (${selectedEntries.length})` : ""}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" role="table" aria-label="Files">
      <div
        role="row"
        className="grid shrink-0 items-center gap-3 border-b bg-muted/40 px-3 text-[11px] font-medium text-muted-foreground"
        style={{ gridTemplateColumns: GRID_TEMPLATE }}
      >
        {table.getFlatHeaders().map((header) => {
          const sortDirection = header.column.getIsSorted();
          return (
            <Button
              key={header.id}
              variant="ghost"
              size="sm"
              role="columnheader"
              aria-sort={sortDirection === "asc" ? "ascending" : sortDirection === "desc" ? "descending" : "none"}
              className="h-8 justify-start gap-1 px-0 text-[11px] font-medium text-muted-foreground hover:bg-transparent"
              onClick={header.column.getToggleSortingHandler()}
            >
              {flexRender(header.column.columnDef.header, header.getContext())}
              {sortDirection === "asc" ? (
                <ArrowUp className="size-3" aria-hidden />
              ) : sortDirection === "desc" ? (
                <ArrowDown className="size-3" aria-hidden />
              ) : (
                <ArrowUpDown className="size-3 opacity-40" aria-hidden />
              )}
            </Button>
          );
        })}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((virtualRow) => renderRow(rows[virtualRow.index], virtualRow.start))}
        </div>
      </div>

      <Dialog open={renameTarget !== null} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
            <DialogDescription className="break-all">{renameTarget?.path}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submitRename();
            }}
            className="space-y-3"
          >
            <div className="space-y-1.5">
              <Label htmlFor="rename-input">New name</Label>
              <Input
                id="rename-input"
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!renameValue.trim() || renameValue === renameTarget?.name}>
                Rename
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={trashTargets.length > 0} onOpenChange={(open) => !open && setTrashTargets([])}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              {trashTargets.length === 1
                ? `"${trashTargets[0]?.name}" will be moved to the Trash. You can restore it from there.`
                : `${trashTargets.length} items will be moved to the Trash. You can restore them from there.`}
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
