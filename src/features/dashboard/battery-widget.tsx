"use client";

import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useBattery } from "@/hooks/use-filesystem";
import { useAnimatedPercentage } from "@/hooks/use-animated-percentage";
import { useFlashOnChange } from "@/hooks/use-flash-on-change";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

type BatteryLevel = "charging" | "warning" | "low" | "medium" | "full";

const BATTERY_ICONS: Record<BatteryLevel, LucideIcon> = {
  charging: BatteryCharging,
  warning: BatteryWarning,
  low: BatteryLow,
  medium: BatteryMedium,
  full: BatteryFull,
};

function batteryLevel(percentage: number, isCharging: boolean): BatteryLevel {
  if (isCharging) return "charging";
  if (percentage <= 10) return "warning";
  if (percentage <= 40) return "low";
  if (percentage <= 80) return "medium";
  return "full";
}

export function BatteryWidget() {
  const { data: battery, isLoading } = useBattery();
  const isPowered = !!battery && (battery.isCharging || battery.isPluggedIn);
  const animatedPercentage = useAnimatedPercentage(battery?.percentage ?? 0, isPowered);
  const flash = useFlashOnChange(Math.floor(Number(animatedPercentage)));

  if (isLoading) return <Skeleton className="h-32 rounded-2xl" />;
  if (!battery || !battery.present) return null;

  const Icon = BATTERY_ICONS[batteryLevel(battery.percentage, isPowered)];
  const statusLabel = battery.isCharging
    ? `Charging · ${formatMinutes(battery.timeToFullMinutes)} to full`
    : battery.isPluggedIn
      ? "Plugged in"
      : `${formatMinutes(battery.timeToEmptyMinutes)} remaining`;
  const accent = isPowered ? "text-emerald-500" : "text-foreground";

  return (
    <Card
      className="rounded-2xl transition-shadow"
      style={flash ? { animation: "card-flash 0.6s ease-out" } : undefined}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">Battery</span>
          <Icon className={cn("size-4", isPowered ? "text-emerald-500" : "text-muted-foreground/60")} aria-hidden />
        </div>
        <div>
          <p className={cn("text-xl font-semibold tracking-tight tabular-nums", accent)}>{animatedPercentage}%</p>
          <p className="text-[11px] text-muted-foreground">{statusLabel}</p>
        </div>
        <Progress
          value={battery.percentage}
          aria-label="Battery charge"
          animated={isPowered ? "charge" : "discharge"}
          className={isPowered ? "[&>div]:bg-emerald-500" : undefined}
        />
        <p className="text-[11px] text-muted-foreground">
          {battery.cycleCount} cycles · {battery.health}% health
        </p>
      </CardContent>
    </Card>
  );
}
