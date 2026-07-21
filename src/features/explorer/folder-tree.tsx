"use client";

import { useState } from "react";
import { ChevronRight, Folder, HardDrive, Home, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDirListing, useDrives, useQuickLocations } from "@/hooks/use-filesystem";
import { useSettingsStore } from "@/store/settings-store";

const MAX_TREE_CHILDREN = 300;

interface TreeNodeProps {
  path: string;
  name: string;
  depth: number;
  icon?: "drive" | "home";
  currentPath: string | null;
  onNavigate: (path: string) => void;
}

function TreeNode({ path, name, depth, icon, currentPath, onNavigate }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const showHidden = useSettingsStore((state) => state.showHidden);
  // Children are fetched lazily: the query only runs once the node is expanded.
  const listing = useDirListing(isExpanded ? path : null);

  const childDirectories = (listing.data?.entries ?? [])
    .filter((entry) => entry.kind === "directory" && (showHidden || !entry.isHidden))
    .slice(0, MAX_TREE_CHILDREN);
  const isActive = currentPath === path;
  const Icon = icon === "drive" ? HardDrive : icon === "home" ? Home : Folder;

  return (
    <div role="treeitem" aria-expanded={isExpanded} aria-selected={isActive}>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md py-1 pr-2 text-xs transition-colors hover:bg-muted/70",
          isActive && "bg-accent font-medium",
        )}
        style={{ paddingLeft: depth * 14 + 4 }}
      >
        <button
          type="button"
          aria-label={isExpanded ? `Collapse ${name}` : `Expand ${name}`}
          className="flex size-4 shrink-0 items-center justify-center rounded hover:bg-muted"
          onClick={() => setIsExpanded((expanded) => !expanded)}
        >
          {isExpanded && listing.isLoading ? (
            <Loader2 className="size-3 animate-spin text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight
              className={cn("size-3 text-muted-foreground transition-transform", isExpanded && "rotate-90")}
              aria-hidden
            />
          )}
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
          onClick={() => onNavigate(path)}
        >
          <Icon className="size-3.5 shrink-0 text-[var(--series-1)]" aria-hidden />
          <span className="truncate">{name}</span>
        </button>
      </div>
      {isExpanded && !listing.isLoading && (
        <div role="group">
          {childDirectories.length === 0 ? (
            <p className="py-0.5 text-[11px] text-muted-foreground" style={{ paddingLeft: (depth + 1) * 14 + 8 }}>
              {listing.isError ? "No access" : "No subfolders"}
            </p>
          ) : (
            childDirectories.map((child) => (
              <TreeNode
                key={child.path}
                path={child.path}
                name={child.name}
                depth={depth + 1}
                currentPath={currentPath}
                onNavigate={onNavigate}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function FolderTree({
  currentPath,
  onNavigate,
}: {
  currentPath: string | null;
  onNavigate: (path: string) => void;
}) {
  const { data: drives } = useDrives();
  const { data: locations } = useQuickLocations();
  const homePath = locations?.find((location) => location.label === "Home")?.path;

  return (
    <ScrollArea className="h-full">
      <div role="tree" aria-label="Folder tree" className="p-2">
        {homePath && (
          <TreeNode
            path={homePath}
            name="Home"
            depth={0}
            icon="home"
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        )}
        {drives?.map((drive) => (
          <TreeNode
            key={drive.mountPath}
            path={drive.mountPath}
            name={drive.name}
            depth={0}
            icon="drive"
            currentPath={currentPath}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
