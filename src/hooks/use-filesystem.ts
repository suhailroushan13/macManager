"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { DuplicateResult, ScanResult, SearchMode } from "@/types/fs";
import { api, ApiRequestError } from "@/lib/api-client";
import { BATTERY_REFETCH_MS } from "@/lib/battery-timing";

export function useDrives() {
  return useQuery({ queryKey: ["drives"], queryFn: api.drives, refetchInterval: 60_000 });
}

export function useBattery() {
  return useQuery({ queryKey: ["battery"], queryFn: api.battery, refetchInterval: BATTERY_REFETCH_MS });
}

export function useQuickLocations() {
  return useQuery({ queryKey: ["locations"], queryFn: api.locations, staleTime: Infinity });
}

export function useDirListing(path: string | null) {
  return useQuery({
    queryKey: ["list", path],
    queryFn: () => api.list(path as string),
    enabled: path !== null,
    placeholderData: keepPreviousData,
    retry: (failureCount, error) =>
      !(error instanceof ApiRequestError && error.status < 500) && failureCount < 2,
  });
}

export interface SearchParams {
  root: string;
  query: string;
  mode: SearchMode;
  caseSensitive: boolean;
  includeHidden: boolean;
}

export function useSearch(params: SearchParams | null) {
  return useQuery({
    queryKey: ["search", params],
    queryFn: () => api.search(params as SearchParams),
    enabled: params !== null && params.query.trim().length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useScanResult() {
  return useQuery({
    queryKey: ["scan"],
    queryFn: api.scanResult,
    refetchInterval: (query) => {
      const state = query.state.data?.progress.state;
      return state === "running" || state === "paused" ? 1000 : false;
    },
  });
}

export function useStartScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (root: string) => api.startScan(root, "full"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scan"] });
      toast.success("Scan started");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start scan"),
  });
}

/** Incremental rescan: reuses unchanged folders from the stored index instead of walking the whole tree again. */
export function useRescan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (root: string) => api.startScan(root, "rescan"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["scan"] });
      toast.success("Rescan started");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not start rescan"),
  });
}

export function useControlScan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.controlScan,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["scan"] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Scan control failed"),
  });
}

export function useDuplicateResult() {
  return useQuery({
    queryKey: ["duplicates"],
    queryFn: api.duplicateResult,
    refetchInterval: (query) =>
      query.state.data?.progress.state === "running" ? 1000 : false,
  });
}

export function useStartDuplicates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ root, minSize }: { root: string; minSize: number }) => api.startDuplicates(root, minSize),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["duplicates"] });
      toast.success("Duplicate scan started");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not start duplicate scan"),
  });
}

export function useCancelDuplicates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.cancelDuplicates,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["duplicates"] }),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Cancel failed"),
  });
}

export function useFileOperation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, paths, newName }: { action: "open" | "reveal" | "terminal" | "trash" | "rename"; paths: string[]; newName?: string }) =>
      api.fileOp(action, paths, newName),
    onSuccess: (_data, variables) => {
      if (variables.action === "trash") {
        // Duplicate/scan results are stored snapshots from the last scan, not a live
        // listing — refetching just returns the same stale data, so trashed files
        // stay visible until the cache is corrected directly.
        const trashedPaths = new Set(variables.paths);
        queryClient.setQueryData<DuplicateResult | undefined>(["duplicates"], (current) => {
          if (!current) return current;
          const groups = current.groups
            .map((group) => ({ ...group, files: group.files.filter((file) => !trashedPaths.has(file)) }))
            .filter((group) => group.files.length > 1);
          return { ...current, groups };
        });
        queryClient.setQueryData<ScanResult | undefined>(["scan"], (current) => {
          if (!current) return current;
          return { ...current, largestFiles: current.largestFiles.filter((file) => !trashedPaths.has(file.path)) };
        });
      }
      if (variables.action === "trash" || variables.action === "rename") {
        void queryClient.invalidateQueries({ queryKey: ["list"] });
        toast.success(variables.action === "trash" ? "Moved to Trash" : "Renamed");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Operation failed"),
  });
}
