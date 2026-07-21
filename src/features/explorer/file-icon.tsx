import {
  AppWindow,
  Archive,
  FileCode,
  FileIcon as FileGeneric,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2,
  Music,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { FileEntry } from "@/types/fs";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<FileEntry["category"], LucideIcon> = {
  image: ImageIcon,
  video: Video,
  audio: Music,
  document: FileText,
  archive: Archive,
  code: FileCode,
  application: AppWindow,
  other: FileGeneric,
};

export function FileIcon({ entry, className }: { entry: FileEntry; className?: string }) {
  const Icon =
    entry.kind === "directory" ? Folder : entry.kind === "symlink" ? Link2 : CATEGORY_ICONS[entry.category];
  return (
    <Icon
      aria-hidden
      className={cn(
        "size-4 shrink-0",
        entry.kind === "directory" ? "text-[var(--series-1)]" : "text-muted-foreground",
        entry.isHidden && "opacity-50",
        className,
      )}
    />
  );
}
