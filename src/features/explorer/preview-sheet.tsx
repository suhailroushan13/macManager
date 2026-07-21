"use client";

import { useQuery } from "@tanstack/react-query";
import type { FileEntry } from "@/types/fs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatDate } from "@/lib/format";
import { CATEGORY_LABELS } from "@/lib/file-category";

const TEXT_EXTENSIONS = new Set(["txt", "md", "json", "csv", "log", "yml", "yaml", "toml", "xml", "html", "css", "scss", "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "sh", "zsh", "sql", "c", "h", "cpp", "swift", "java", "kt", "php"]);
const MAX_TEXT_PREVIEW_BYTES = 1024 * 1024;

function previewUrl(entry: FileEntry): string {
  return `/api/file?path=${encodeURIComponent(entry.path)}`;
}

function TextPreview({ entry }: { entry: FileEntry }) {
  const { data: content, isError } = useQuery({
    queryKey: ["preview-text", entry.path],
    queryFn: async () => {
      const response = await fetch(previewUrl(entry));
      if (!response.ok) throw new Error("Could not load file.");
      const text = await response.text();
      return text.slice(0, 100_000);
    },
    retry: false,
  });

  if (isError) {
    return <p className="text-xs text-muted-foreground">Could not load a text preview for this file.</p>;
  }
  if (content === undefined) return <p className="text-xs text-muted-foreground">Loading…</p>;
  return (
    <pre className="max-h-96 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed">
      {content}
    </pre>
  );
}

function PreviewBody({ entry }: { entry: FileEntry }) {
  if (entry.kind === "directory") return null;
  const url = previewUrl(entry);

  if (entry.category === "image" && entry.extension !== "psd" && entry.extension !== "ai") {
    // eslint-disable-next-line @next/next/no-img-element -- local API stream; next/image cannot optimize it.
    return <img src={url} alt={entry.name} className="max-h-96 w-full rounded-lg border object-contain" />;
  }
  if (entry.category === "video") {
    return <video src={url} controls className="max-h-96 w-full rounded-lg border" aria-label={entry.name} />;
  }
  if (entry.category === "audio") {
    return <audio src={url} controls className="w-full" aria-label={entry.name} />;
  }
  if (entry.extension === "pdf") {
    return <iframe src={url} title={entry.name} className="h-96 w-full rounded-lg border" />;
  }
  if (TEXT_EXTENSIONS.has(entry.extension) && entry.size <= MAX_TEXT_PREVIEW_BYTES) {
    return <TextPreview entry={entry} />;
  }
  return <p className="text-xs text-muted-foreground">No inline preview for this file type.</p>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="break-all text-right font-medium">{value}</dd>
    </div>
  );
}

export function PreviewSheet({
  entry,
  onClose,
}: {
  entry: FileEntry | null;
  onClose: () => void;
}) {
  const unitSystem = useSettingsStore((state) => state.unitSystem);

  return (
    <Sheet open={entry !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        {entry && (
          <>
            <SheetHeader>
              <SheetTitle className="break-all text-left text-base">{entry.name}</SheetTitle>
              <SheetDescription className="break-all text-left font-mono text-[11px]">
                {entry.path}
              </SheetDescription>
            </SheetHeader>
            <ScrollArea className="h-full px-4 pb-6">
              <PreviewBody entry={entry} />
              <Separator className="my-4" />
              <dl>
                <DetailRow label="Kind" value={entry.kind === "directory" ? "Folder" : CATEGORY_LABELS[entry.category]} />
                {entry.extension && <DetailRow label="Extension" value={entry.extension} />}
                {entry.kind !== "directory" && <DetailRow label="Size" value={formatBytes(entry.size, unitSystem)} />}
                <DetailRow label="Owner" value={entry.owner} />
                <DetailRow label="Permissions" value={entry.permissions} />
                <DetailRow label="Created" value={formatDate(entry.createdAt)} />
                <DetailRow label="Modified" value={formatDate(entry.modifiedAt)} />
                <DetailRow label="Last opened" value={formatDate(entry.accessedAt)} />
                <DetailRow label="Hidden" value={entry.isHidden ? "Yes" : "No"} />
                <DetailRow label="Read-only" value={entry.isReadonly ? "Yes" : "No"} />
              </dl>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
