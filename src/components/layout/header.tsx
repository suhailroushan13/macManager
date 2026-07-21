"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Pause, Play, RefreshCw, RotateCw, ScanSearch, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { useControlScan, useRescan, useScanResult, useStartScan } from "@/hooks/use-filesystem";
import { formatCount } from "@/lib/format";

function ScanControls() {
  const { data: scan } = useScanResult();
  const startScan = useStartScan();
  const rescan = useRescan();
  const controlScan = useControlScan();
  const state = scan?.progress.state ?? "idle";
  const isActive = state === "running" || state === "paused";
  const knownRoot = scan?.progress.root;

  if (!isActive) {
    return (
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => startScan.mutate(knownRoot ?? "/")}
              disabled={startScan.isPending}
            >
              {startScan.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ScanSearch className="size-4" aria-hidden />
              )}
              Scan Disk
            </Button>
          </TooltipTrigger>
          <TooltipContent>Full scan of the startup disk to compute usage statistics</TooltipContent>
        </Tooltip>
        {knownRoot && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Rescan"
                onClick={() => rescan.mutate(knownRoot)}
                disabled={rescan.isPending}
              >
                {rescan.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                  <RotateCw className="size-4" aria-hidden />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Rescan — only re-reads folders that changed since the last scan</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Badge variant="secondary" className="gap-1.5 font-normal tabular-nums">
        <Loader2 className="size-3 animate-spin" aria-hidden />
        {state === "paused" ? "Paused" : "Scanning"} · {formatCount(scan?.progress.filesScanned ?? 0)} files
      </Badge>
      <Button
        variant="ghost"
        size="icon"
        aria-label={state === "paused" ? "Resume scan" : "Pause scan"}
        onClick={() => controlScan.mutate(state === "paused" ? "resume" : "pause")}
      >
        {state === "paused" ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Cancel scan" onClick={() => controlScan.mutate("cancel")}>
        <X className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function Header() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    const root = searchParams.get("path") ?? "";
    const params = new URLSearchParams({ q: trimmed });
    if (root) params.set("path", root);
    router.push(`/explorer?${params}`);
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <form onSubmit={handleSearch} className="relative w-full max-w-sm" role="search">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search files…"
          aria-label="Search files"
          className="h-9 pl-8"
        />
      </form>

      <div className="ml-auto flex items-center gap-1.5">
        <ScanControls />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Refresh"
              onClick={() => void queryClient.invalidateQueries()}
            >
              <RefreshCw className="size-4" aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh all data</TooltipContent>
        </Tooltip>
        <ThemeToggle />
      </div>
    </header>
  );
}
