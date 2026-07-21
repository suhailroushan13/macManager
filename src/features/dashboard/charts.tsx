"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { FileCategory } from "@/types/fs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Boxes } from "lucide-react";
import { useBattery, useDrives, useScanResult } from "@/hooks/use-filesystem";
import { useAnimatedPercentage } from "@/hooks/use-animated-percentage";
import { useFlashOnChange } from "@/hooks/use-flash-on-change";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatCount, formatMinutes } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/file-category";
import { DEV_FOLDER_LABELS, LARGE_DEPENDENCY_WARNING_BYTES } from "@/lib/dev-folders";
import { cn } from "@/lib/utils";
import type { UnitSystem } from "@/lib/format";
import type { DevFolderCategory } from "@/types/fs";

/** Fixed category → series-slot mapping; color follows the entity, never rank. */
const CATEGORY_SERIES: Record<FileCategory, string> = {
  image: "var(--series-1)",
  video: "var(--series-2)",
  audio: "var(--series-3)",
  document: "var(--series-4)",
  archive: "var(--series-5)",
  code: "var(--series-6)",
  application: "var(--series-7)",
  other: "var(--series-8)",
};

interface TooltipPayloadEntry {
  payload?: { label?: string; name?: string; bytes: number };
}

function BytesTooltip({
  active,
  payload,
  unitSystem,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  unitSystem: UnitSystem;
}) {
  const entry = payload?.[0]?.payload;
  if (!active || !entry) return null;
  return (
    <div className="rounded-lg border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium">{entry.label ?? entry.name}</p>
      <p className="text-muted-foreground tabular-nums">{formatBytes(entry.bytes, unitSystem)}</p>
    </div>
  );
}

function ChartCard({
  title,
  description,
  children,
  className,
  style,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <Card className={cn("rounded-2xl transition-shadow", className)} style={style}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-52 items-center justify-center text-center text-xs text-muted-foreground">
      {message}
    </div>
  );
}

export function StorageDonut() {
  const { data: drives } = useDrives();
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const rootDrive = drives?.find((drive) => drive.isRoot) ?? drives?.[0];

  const slices = useMemo(() => {
    if (!rootDrive) return [];
    return [
      { name: "Used", bytes: rootDrive.usedBytes, fill: "var(--series-1)" },
      { name: "Free", bytes: rootDrive.freeBytes, fill: "var(--muted)" },
    ];
  }, [rootDrive]);

  return (
    <ChartCard title="Storage Usage" description={rootDrive ? rootDrive.name : "Startup disk"}>
      {!rootDrive ? (
        <EmptyChart message="No drive data available." />
      ) : (
        <div className="flex items-center gap-6">
          <div className="relative h-52 w-52 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="bytes"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="92%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.fill} />
                  ))}
                </Pie>
                <Tooltip content={<BytesTooltip unitSystem={unitSystem} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-semibold tabular-nums">
                {Math.round(rootDrive.usedPercent * 100)}%
              </span>
              <span className="text-[11px] text-muted-foreground">used</span>
            </div>
          </div>
          <ul className="space-y-2 text-xs">
            {slices.map((slice) => (
              <li key={slice.name} className="flex items-center gap-2">
                <span className="size-2.5 rounded-sm" style={{ background: slice.fill }} aria-hidden />
                <span className="text-muted-foreground">{slice.name}</span>
                <span className="ml-auto pl-4 font-medium tabular-nums">
                  {formatBytes(slice.bytes, unitSystem)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

export function BatteryDonut() {
  const { data: battery } = useBattery();

  const isPowered = !!battery && (battery.isCharging || battery.isPluggedIn);
  const animatedPercentage = useAnimatedPercentage(battery?.percentage ?? 0, isPowered);
  const flash = useFlashOnChange(Math.floor(Number(animatedPercentage)));

  const slices = useMemo(() => {
    if (!battery || !battery.present) return [];
    const fill = isPowered ? "#10b981" : "var(--series-1)";
    return [
      { name: "Charged", value: battery.percentage, fill },
      { name: "Remaining", value: 100 - battery.percentage, fill: "var(--muted)" },
    ];
  }, [battery, isPowered]);

  const statusLabel = !battery
    ? ""
    : battery.isCharging
      ? `Charging · ${formatMinutes(battery.timeToFullMinutes)} to full`
      : battery.isPluggedIn
        ? "Plugged in"
        : `${formatMinutes(battery.timeToEmptyMinutes)} remaining`;

  return (
    <ChartCard
      title="Battery"
      description={battery?.present ? statusLabel : "No battery on this Mac"}
      style={flash ? { animation: "card-flash 0.6s ease-out" } : undefined}
    >
      {!battery || !battery.present ? (
        <EmptyChart message="No battery detected." />
      ) : (
        <div className="flex items-center gap-6">
          <div className="relative h-52 w-52 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="68%"
                  outerRadius="92%"
                  paddingAngle={2}
                  strokeWidth={0}
                  isAnimationActive={false}
                >
                  {slices.map((slice) => (
                    <Cell key={slice.name} fill={slice.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
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
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span
                className={cn(
                  "text-lg font-semibold tabular-nums",
                  isPowered && "text-emerald-500",
                )}
              >
                {animatedPercentage}%
              </span>
              <span className="text-[11px] text-muted-foreground">{isPowered ? "charging" : "charged"}</span>
            </div>
          </div>
          <ul className="space-y-2 text-xs">
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground">Cycle Count</span>
              <span className="ml-auto pl-4 font-medium tabular-nums">{battery.cycleCount}</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground">Health</span>
              <span className="ml-auto pl-4 font-medium tabular-nums">{battery.health}%</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground">Time to Empty</span>
              <span className="ml-auto pl-4 font-medium tabular-nums">
                {battery.isCharging ? "—" : formatMinutes(battery.timeToEmptyMinutes)}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-muted-foreground">Time to Full</span>
              <span className="ml-auto pl-4 font-medium tabular-nums">
                {battery.isCharging ? formatMinutes(battery.timeToFullMinutes) : "—"}
              </span>
            </li>
          </ul>
        </div>
      )}
    </ChartCard>
  );
}

export function CategoryChart() {
  const { data: scan } = useScanResult();
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const router = useRouter();

  const data = useMemo(
    () =>
      (scan?.categories ?? []).map((stat) => ({
        category: stat.category,
        label: CATEGORY_LABELS[stat.category],
        bytes: stat.bytes,
        files: stat.files,
        fill: CATEGORY_SERIES[stat.category],
      })),
    [scan],
  );

  return (
    <ChartCard title="File Types" description="Bytes per category from the last scan — click a bar to see the files">
      {data.length === 0 ? (
        <EmptyChart message="Run a scan to see the breakdown by file type." />
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(180, data.length * 32)}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 48, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={92}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<BytesTooltip unitSystem={unitSystem} />} />
            <Bar
              dataKey="bytes"
              radius={[0, 4, 4, 0]}
              barSize={14}
              isAnimationActive={false}
              cursor="pointer"
              onClick={(entry) => {
                const category = (entry as unknown as { payload?: { category: FileCategory } }).payload?.category;
                if (category) router.push(`/large-files?category=${category}`);
              }}
              label={{
                position: "right",
                fontSize: 10,
                fill: "var(--muted-foreground)",
                formatter: (value: unknown) => formatBytes(Number(value), unitSystem),
              }}
            >
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

const DEV_SUMMARY_ORDER: DevFolderCategory[] = ["dependencies", "build", "cache", "venv"];

export function DeveloperSummary() {
  const { data: scan } = useScanResult();
  const unitSystem = useSettingsStore((state) => state.unitSystem);

  const summaryByCategory = new Map((scan?.devSummary ?? []).map((entry) => [entry.category, entry]));
  const totalBytes = (scan?.devSummary ?? []).reduce((sum, entry) => sum + entry.bytes, 0);
  const largestDependency = (scan?.devFolders ?? []).find(
    (folder) => folder.category === "dependencies" && folder.bytes >= LARGE_DEPENDENCY_WARNING_BYTES,
  );

  return (
    <ChartCard title="Developer" description="node_modules, build output, caches, and virtual environments">
      {totalBytes === 0 ? (
        <EmptyChart message="Run a scan to see developer folder usage." />
      ) : (
        <div className="space-y-3">
          <ul className="grid grid-cols-2 gap-3">
            {DEV_SUMMARY_ORDER.map((category) => {
              const entry = summaryByCategory.get(category);
              return (
                <li key={category} className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">{DEV_FOLDER_LABELS[category]}</p>
                  <p className="text-sm font-semibold tabular-nums">{formatBytes(entry?.bytes ?? 0, unitSystem)}</p>
                  <p className="text-[11px] text-muted-foreground">{formatCount(entry?.folders ?? 0)} folders</p>
                </li>
              );
            })}
          </ul>
          {largestDependency && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" aria-hidden />
              <p>
                Large dependency folder detected ({formatBytes(largestDependency.bytes, unitSystem)}). Project{" "}
                <span className="font-medium">{largestDependency.projectName}</span>&apos;s {largestDependency.name} is
                consuming significant storage.
              </p>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            <Link href="/developer" className="inline-flex items-center gap-1 underline underline-offset-2 hover:text-foreground">
              <Boxes className="size-3" aria-hidden /> View largest node_modules
            </Link>
          </p>
        </div>
      )}
    </ChartCard>
  );
}

export function TopFoldersChart() {
  const { data: scan } = useScanResult();
  const unitSystem = useSettingsStore((state) => state.unitSystem);

  const data = useMemo(
    () =>
      (scan?.largestFolders ?? []).slice(0, 10).map((folder) => {
        const name = folder.path.split("/").filter(Boolean).pop() ?? folder.path;
        return {
          label: name.length > 16 ? `${name.slice(0, 15)}…` : name,
          path: folder.path,
          bytes: folder.bytes,
          files: folder.files,
        };
      }),
    [scan],
  );

  return (
    <ChartCard title="Largest Folders" description="Top folders by size from the last scan">
      {data.length === 0 ? (
        <EmptyChart message="Run a scan to find your largest folders." />
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30)}>
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 56, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="label"
                width={110}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.4 }} content={<BytesTooltip unitSystem={unitSystem} />} />
              <Bar
                dataKey="bytes"
                fill="var(--series-1)"
                radius={[0, 4, 4, 0]}
                barSize={12}
                isAnimationActive={false}
                label={{
                  position: "right",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                  formatter: (value: unknown) => formatBytes(Number(value), unitSystem),
                }}
              />
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {formatCount(scan?.progress.foldersScanned ?? 0)} folders scanned ·{" "}
            <Link href="/large-files" className="underline underline-offset-2 hover:text-foreground">
              View largest files
            </Link>
          </p>
        </div>
      )}
    </ChartCard>
  );
}
