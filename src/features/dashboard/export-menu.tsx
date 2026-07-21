"use client";

import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScanResult } from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";
import { buildScanReport, downloadContent, type ExportFormat } from "@/lib/export";

const FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: "CSV",
  json: "JSON",
  markdown: "Markdown",
};

export function ExportMenu() {
  const { data: scan } = useScanResult();
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const hasScan = Boolean(scan && scan.progress.filesScanned > 0);

  const exportReport = (format: ExportFormat) => {
    if (!scan) return;
    const report = buildScanReport(scan, format, unitSystem);
    const date = new Date().toISOString().slice(0, 10);
    downloadContent(`disk-report-${date}.${report.extension}`, report.content, report.mime);
    toast.success(`${FORMAT_LABELS[format]} report downloaded`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={!hasScan}>
          <FileDown className="size-4" aria-hidden />
          Export report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-xs">Last scan report</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(FORMAT_LABELS) as ExportFormat[]).map((format) => (
          <DropdownMenuItem key={format} onSelect={() => exportReport(format)}>
            {FORMAT_LABELS[format]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
