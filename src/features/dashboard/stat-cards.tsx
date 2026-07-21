"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Database, Files, Folder, HardDrive, PieChart, Server } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDrives, useScanResult } from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatCount } from "@/lib/format";

interface StatCard {
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
}

export function StatCards() {
  const { data: drives, isLoading } = useDrives();
  const { data: scan } = useScanResult();
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const shouldReduceMotion = useReducedMotion();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  const totalBytes = drives?.reduce((sum, drive) => sum + drive.totalBytes, 0) ?? 0;
  const usedBytes = drives?.reduce((sum, drive) => sum + drive.usedBytes, 0) ?? 0;
  const freeBytes = drives?.reduce((sum, drive) => sum + drive.freeBytes, 0) ?? 0;
  const hasScan = scan && scan.progress.filesScanned > 0;

  const cards: StatCard[] = [
    { label: "Total Storage", value: formatBytes(totalBytes, unitSystem), hint: "All mounted drives", icon: Database },
    { label: "Used", value: formatBytes(usedBytes, unitSystem), hint: totalBytes > 0 ? `${Math.round((usedBytes / totalBytes) * 100)}% of capacity` : "—", icon: PieChart },
    { label: "Available", value: formatBytes(freeBytes, unitSystem), hint: "Free across drives", icon: Server },
    { label: "Files", value: hasScan ? formatCount(scan.progress.filesScanned) : "—", hint: hasScan ? "From last scan" : "Run a scan", icon: Files },
    { label: "Folders", value: hasScan ? formatCount(scan.progress.foldersScanned) : "—", hint: hasScan ? "From last scan" : "Run a scan", icon: Folder },
    { label: "Drives", value: String(drives?.length ?? 0), hint: "Connected volumes", icon: HardDrive },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card, index) => (
        <motion.div
          key={card.label}
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: index * 0.04 }}
        >
          <Card className="h-full rounded-2xl transition-shadow hover:shadow-md">
            <CardContent className="flex h-full flex-col justify-between gap-2 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
                <card.icon className="size-4 text-muted-foreground/60" aria-hidden />
              </div>
              <div>
                <p className="text-xl font-semibold tracking-tight">{card.value}</p>
                <p className="text-[11px] text-muted-foreground">{card.hint}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
