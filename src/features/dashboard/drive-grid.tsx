"use client";

import Link from "next/link";
import { HardDrive, HeartPulse, Lock, Wifi } from "lucide-react";
import type { DriveInfo } from "@/types/fs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useDrives } from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatPercent } from "@/lib/format";

function driveKindLabel(drive: DriveInfo): string {
  if (drive.kind === "network") return "Network";
  if (drive.kind === "external") return "External";
  return "Internal";
}

function DriveCard({ drive }: { drive: DriveInfo }) {
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const isNearlyFull = drive.usedPercent > 0.9;

  return (
    <Link
      href={`/explorer?path=${encodeURIComponent(drive.mountPath)}`}
      className="group rounded-2xl focus-visible:outline-2 focus-visible:outline-ring"
      aria-label={`Browse ${drive.name}`}
    >
      <Card className="h-full rounded-2xl transition-shadow group-hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              {drive.kind === "network" ? (
                <Wifi className="size-4 text-muted-foreground" aria-hidden />
              ) : (
                <HardDrive className="size-4 text-muted-foreground" aria-hidden />
              )}
              <span className="truncate">{drive.name}</span>
            </CardTitle>
            <div className="flex items-center gap-1.5">
              {drive.isReadonly && (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <Lock className="size-2.5" aria-hidden /> Read-only
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {driveKindLabel(drive)}
              </Badge>
            </div>
          </div>
          <p className="truncate font-mono text-[11px] text-muted-foreground">
            {drive.mountPath} · {drive.filesystem}
            {drive.isSolidState !== null && ` · ${drive.isSolidState ? "SSD" : "HDD"}`}
          </p>
          {drive.smartStatus && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <HeartPulse className="size-3" aria-hidden />
              SMART: {drive.smartStatus}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <Progress
            value={drive.usedPercent * 100}
            aria-label={`${drive.name}: ${formatPercent(drive.usedPercent)} used`}
          />
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground tabular-nums">
              {formatBytes(drive.usedBytes, unitSystem)} used · {formatBytes(drive.freeBytes, unitSystem)} free
            </span>
            <span className={isNearlyFull ? "font-semibold text-destructive" : "font-medium"}>
              {formatPercent(drive.usedPercent)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function DriveGrid() {
  const { data: drives, isLoading, isError } = useDrives();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-36 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (isError || !drives?.length) {
    return (
      <Card className="rounded-2xl">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {isError ? "Could not read mounted drives." : "No drives detected."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {drives.map((drive) => (
        <DriveCard key={drive.mountPath} drive={drive} />
      ))}
    </div>
  );
}
