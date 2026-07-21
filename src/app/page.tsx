import type { Metadata } from "next";
import { StatCards } from "@/features/dashboard/stat-cards";
import { BatteryWidget } from "@/features/dashboard/battery-widget";
import { DriveGrid } from "@/features/dashboard/drive-grid";
import { ExportMenu } from "@/features/dashboard/export-menu";
import { BatteryDonut, CategoryChart, DeveloperSummary, StorageDonut, TopFoldersChart } from "@/features/dashboard/charts";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Storage overview: capacity, usage per drive, file type breakdown, and largest folders.",
};

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Storage at a glance across your mounted drives.</p>
        </div>
        <ExportMenu />
      </div>
      <StatCards />
      <section aria-label="Drives" className="grid gap-0 md:grid-cols-[1fr_16rem]">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-muted-foreground">Drives</h2>
          <DriveGrid />
        </div>
        <BatteryWidget />
      </section>
      <section aria-label="Charts" className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <StorageDonut />
        <BatteryDonut />
        <CategoryChart />
        <TopFoldersChart />
        <DeveloperSummary />
      </section>
    </div>
  );
}
