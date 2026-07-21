"use client";

import React, { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Star } from "lucide-react";
import type { FileCategory, FileEntry, SearchMode } from "@/types/fs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FileTable } from "./file-table";
import { FolderTree } from "./folder-tree";
import { PreviewSheet } from "./preview-sheet";
import { useDirListing, useQuickLocations, useSearch } from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";
import { CATEGORY_LABELS } from "@/lib/file-category";
import { formatCount } from "@/lib/format";

type KindFilter = "all" | "file" | "directory";
type CategoryFilter = FileCategory | "all";

const SEARCH_MODES: SearchMode[] = ["contains", "startsWith", "endsWith", "regex", "fuzzy"];

function PathBreadcrumb({ path, onNavigate }: { path: string; onNavigate: (path: string) => void }) {
  const segments = path.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => ({
    label: segment,
    path: `/${segments.slice(0, index + 1).join("/")}`,
  }));

  return (
    <Breadcrumb>
      <BreadcrumbList className="flex-nowrap overflow-x-auto whitespace-nowrap">
        <BreadcrumbItem>
          {crumbs.length === 0 ? (
            <BreadcrumbPage>/</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <button type="button" onClick={() => onNavigate("/")}>/</button>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {crumbs.map((crumb, index) => (
          <React.Fragment key={crumb.path}>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              {index === crumbs.length - 1 ? (
                <BreadcrumbPage className="max-w-48 truncate">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <button type="button" className="max-w-40 truncate" onClick={() => onNavigate(crumb.path)}>
                    {crumb.label}
                  </button>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </React.Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

export function Explorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: locations } = useQuickLocations();
  const homePath = locations?.find((location) => location.label === "Home")?.path ?? null;

  const path = searchParams.get("path") ?? homePath;
  const query = searchParams.get("q")?.trim() ?? "";
  const isSearching = query.length > 0;
  // Search options live in the URL so saved searches can restore them exactly.
  const modeParam = searchParams.get("mode");
  const searchMode: SearchMode = SEARCH_MODES.includes(modeParam as SearchMode)
    ? (modeParam as SearchMode)
    : "contains";
  const caseSensitive = searchParams.get("case") === "1";

  const showHidden = useSettingsStore((state) => state.showHidden);
  const setShowHidden = useSettingsStore((state) => state.setShowHidden);
  const addSavedSearch = useSettingsStore((state) => state.addSavedSearch);
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);

  const listing = useDirListing(isSearching ? null : path);
  const search = useSearch(
    isSearching && path
      ? { root: path, query, mode: searchMode, caseSensitive, includeHidden: showHidden }
      : null,
  );

  const navigate = (nextPath: string) => {
    router.push(`/explorer?path=${encodeURIComponent(nextPath)}`);
  };

  const setSearchParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams);
    if (value === null) params.delete(key);
    else params.set(key, value);
    router.replace(`/explorer?${params}`);
  };

  const saveCurrentSearch = () => {
    if (!path || !isSearching) return;
    addSavedSearch({ name: query, root: path, query, mode: searchMode, caseSensitive, includeHidden: showHidden });
    toast.success("Search saved to sidebar");
  };

  const rawEntries = isSearching ? search.data?.results : listing.data?.entries;
  const entries = useMemo(() => {
    let filtered = rawEntries ?? [];
    if (!showHidden && !isSearching) filtered = filtered.filter((entry) => !entry.isHidden);
    if (kindFilter !== "all") {
      filtered = filtered.filter((entry) =>
        kindFilter === "directory" ? entry.kind === "directory" : entry.kind !== "directory",
      );
    }
    if (categoryFilter !== "all") {
      filtered = filtered.filter((entry) => entry.kind !== "directory" && entry.category === categoryFilter);
    }
    // Folders first, then natural name order — the default explorer expectation.
    return [...filtered].sort((a, b) => {
      const aIsDirectory = a.kind === "directory" ? 0 : 1;
      const bIsDirectory = b.kind === "directory" ? 0 : 1;
      if (aIsDirectory !== bIsDirectory) return aIsDirectory - bIsDirectory;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
  }, [rawEntries, showHidden, isSearching, kindFilter, categoryFilter]);

  const isLoading = isSearching ? search.isLoading : listing.isLoading;
  const error = isSearching ? search.error : listing.error;

  if (!path) {
    return (
      <div className="p-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-2.5">
        {isSearching ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Results for “{query}”</span>
            <span className="text-xs text-muted-foreground">in {path}</span>
            {search.isFetching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" aria-hidden />}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Save this search" onClick={saveCurrentSearch}>
                  <Star className="size-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save this search to the sidebar</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <PathBreadcrumb path={path} onNavigate={navigate} />
        )}

        <div className="ml-auto flex flex-wrap items-center gap-3">
          {isSearching && (
            <>
              <Select value={searchMode} onValueChange={(value) => setSearchParam("mode", value)}>
                <SelectTrigger size="sm" className="h-8 w-32 text-xs" aria-label="Search mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="startsWith">Starts with</SelectItem>
                  <SelectItem value="endsWith">Ends with</SelectItem>
                  <SelectItem value="fuzzy">Fuzzy</SelectItem>
                  <SelectItem value="regex">Regex</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <Switch
                  id="case-sensitive"
                  checked={caseSensitive}
                  onCheckedChange={(checked) => setSearchParam("case", checked ? "1" : null)}
                />
                <Label htmlFor="case-sensitive" className="text-xs text-muted-foreground">
                  Case
                </Label>
              </div>
            </>
          )}
          <Select value={kindFilter} onValueChange={(value) => setKindFilter(value as KindFilter)}>
            <SelectTrigger size="sm" className="h-8 w-28 text-xs" aria-label="Filter by kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All items</SelectItem>
              <SelectItem value="directory">Folders</SelectItem>
              <SelectItem value="file">Files</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}>
            <SelectTrigger size="sm" className="h-8 w-32 text-xs" aria-label="Filter by type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(CATEGORY_LABELS) as FileCategory[]).map((category) => (
                <SelectItem key={category} value={category}>
                  {CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <Switch id="show-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
            <Label htmlFor="show-hidden" className="text-xs text-muted-foreground">
              Hidden
            </Label>
          </div>
        </div>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="20%" minSize="180px" maxSize="40%" collapsible className="hidden md:block">
          <FolderTree currentPath={path} onNavigate={navigate} />
        </ResizablePanel>
        <ResizableHandle withHandle className="hidden md:flex" />
        <ResizablePanel defaultSize="80%">
          <div className="flex h-full min-h-0 flex-col">
            {error ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <AlertTriangle className="size-6 text-muted-foreground" aria-hidden />
                <p className="text-sm font-medium">Could not open this location</p>
                <p className="max-w-md text-xs text-muted-foreground">
                  {error instanceof Error ? error.message : "Unknown error."}
                </p>
              </div>
            ) : isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 12 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 rounded-md" />
                ))}
              </div>
            ) : (
              <FileTable
                entries={entries}
                onOpenDirectory={navigate}
                onPreview={setPreviewEntry}
                emptyMessage={
                  isSearching
                    ? "No files matched your search. Try a broader query or enable hidden files."
                    : "This folder is empty, or every item is filtered out."
                }
              />
            )}

            <div className="flex h-8 shrink-0 items-center gap-3 border-t px-4 text-[11px] text-muted-foreground">
              <span className="tabular-nums">{formatCount(entries.length)} items</span>
              {isSearching && search.data && (
                <span className="tabular-nums">
                  searched {formatCount(search.data.visited)} entries in {search.data.elapsedMs}ms
                  {search.data.truncated && " · results truncated"}
                </span>
              )}
              {!isSearching && listing.data?.truncated && (
                <Badge variant="outline" className="text-[10px]">
                  Listing capped at 5,000 items
                </Badge>
              )}
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      <PreviewSheet entry={previewEntry} onClose={() => setPreviewEntry(null)} />
    </div>
  );
}
