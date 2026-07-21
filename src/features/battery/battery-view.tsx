"use client";

import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, BatteryWarning } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-xl border p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export function BatteryView() {
  const { data: battery, isLoading } = useBattery();
  const isPowered = !!battery && (battery.isCharging || battery.isPluggedIn);
  const animatedPercentage = useAnimatedPercentage(battery?.percentage ?? 0, isPowered);
  const flash = useFlashOnChange(Math.floor(Number(animatedPercentage)));

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Skeleton className="h-40 rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!battery || !battery.present) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <h1 className="text-lg font-semibold tracking-tight">Battery</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No battery detected. This machine may not have one, or battery status isn&apos;t available.
        </p>
      </div>
    );
  }

  const Icon = BATTERY_ICONS[batteryLevel(battery.percentage, isPowered)];
  const statusVariant = battery.isCharging ? "default" : battery.isPluggedIn ? "secondary" : "outline";
  const statusLabel = battery.isFullyCharged
    ? "Fully charged"
    : battery.isCharging
      ? "Charging"
      : battery.isPluggedIn
        ? "Plugged in"
        : "On battery";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Battery</h1>
        <p className="text-sm text-muted-foreground">Charge level, health, and cycle count for this Mac.</p>
      </div>

      <Card
        className="rounded-2xl transition-shadow"
        style={flash ? { animation: "card-flash 0.6s ease-out" } : undefined}
      >
        <CardContent className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div className="relative flex size-14 shrink-0 items-center justify-center">
              <div
                className="pointer-events-none absolute inset-0 rounded-full"
                style={{
                  background: isPowered
                    ? "conic-gradient(from 0deg, transparent 0deg, rgba(16,185,129,0.65) 45deg, transparent 100deg)"
                    : "conic-gradient(from 0deg, transparent 0deg, rgba(120,120,120,0.5) 45deg, transparent 100deg)",
                  WebkitMaskImage:
                    "radial-gradient(circle, transparent 66%, black 68%, black 92%, transparent 94%)",
                  maskImage: "radial-gradient(circle, transparent 66%, black 68%, black 92%, transparent 94%)",
                  animation: `${isPowered ? "donut-sweep-cw" : "donut-sweep-ccw"} 2.4s linear infinite`,
                }}
              />
              <Icon className={cn("size-5", isPowered ? "text-emerald-500" : "text-muted-foreground")} aria-hidden />
            </div>
            <div className="flex flex-1 items-center gap-2 pl-3">
              <span className={cn("text-2xl font-semibold tracking-tight tabular-nums", isPowered && "text-emerald-500")}>
                {animatedPercentage}%
              </span>
            </div>
            <Badge
              variant={statusVariant}
              className={isPowered ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500" : undefined}
            >
              {statusLabel}
            </Badge>
          </div>
          <Progress
            value={battery.percentage}
            aria-label="Battery charge"
            animated={isPowered ? "charge" : "discharge"}
            className={isPowered ? "[&>div]:bg-emerald-500" : undefined}
          />
          <p className="text-xs text-muted-foreground">
            {battery.isCharging
              ? `${formatMinutes(battery.timeToFullMinutes)} until fully charged`
              : battery.isPluggedIn
                ? "Not discharging"
                : `${formatMinutes(battery.timeToEmptyMinutes)} remaining`}
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Cycle Count" value={String(battery.cycleCount)} />
        <Stat label="Health" value={`${battery.health}%`} />
        <Stat label="Time to Empty" value={battery.isCharging ? "—" : formatMinutes(battery.timeToEmptyMinutes)} />
        <Stat label="Time to Full" value={battery.isCharging ? formatMinutes(battery.timeToFullMinutes) : "—"} />
      </div>
    </div>
  );
}
