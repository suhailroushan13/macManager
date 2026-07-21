"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  BatteryMedium,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  FileText,
  Files,
  HardDrive,
  Home,
  Image as ImageIcon,
  LayoutDashboard,
  Monitor,
  Music,
  Search,
  Settings,
  Star,
  Trash2,
  Video,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDrives, useQuickLocations } from "@/hooks/use-filesystem";
import { useHydrated } from "@/hooks/use-hydrated";
import { useSettingsStore } from "@/store/settings-store";
import { formatBytes, formatPercent } from "@/lib/format";

const LOCATION_ICONS: Record<string, LucideIcon> = {
  home: Home,
  download: Download,
  "file-text": FileText,
  image: ImageIcon,
  video: Video,
  music: Music,
  monitor: Monitor,
  "trash-2": Trash2,
};

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  isCollapsed: boolean;
}

function NavItem({ href, label, icon: Icon, isActive, isCollapsed }: NavItemProps) {
  const link = (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        isCollapsed && "justify-center px-0",
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      {!isCollapsed && <span className="truncate">{label}</span>}
    </Link>
  );
  if (!isCollapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function SectionLabel({ children, isCollapsed }: { children: string; isCollapsed: boolean }) {
  if (isCollapsed) return null;
  return (
    <p className="px-2.5 pb-1 pt-4 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
      {children}
    </p>
  );
}

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentPath = searchParams.get("path");
  const { data: drives } = useDrives();
  const { data: locations } = useQuickLocations();
  const favorites = useSettingsStore((state) => state.favorites);
  const savedSearches = useSettingsStore((state) => state.savedSearches);
  const removeSavedSearch = useSettingsStore((state) => state.removeSavedSearch);
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  // Persisted store values differ from server-rendered HTML; render them post-hydration only.
  const isHydrated = useHydrated();

  const rootDrive = drives?.find((drive) => drive.isRoot) ?? drives?.[0];
  const explorerHref = (path: string) => `/explorer?path=${encodeURIComponent(path)}`;
  const isExplorerAt = (path: string) => pathname === "/explorer" && currentPath === path;

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200",
        isCollapsed ? "w-14" : "w-60",
      )}
      aria-label="Primary navigation"
    >
      <div className={cn("flex h-14 items-center gap-2 px-4", isCollapsed && "justify-center px-0")}>
        <HardDrive className="size-5 text-primary" aria-hidden />
        {!isCollapsed && <span className="text-sm font-semibold tracking-tight">macManager</span>}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        <NavItem href="/" label="Dashboard" icon={LayoutDashboard} isActive={pathname === "/"} isCollapsed={isCollapsed} />
        <NavItem
          href="/large-files"
          label="Large Files"
          icon={Files}
          isActive={pathname === "/large-files"}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/duplicates"
          label="Duplicates"
          icon={Copy}
          isActive={pathname === "/duplicates"}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/developer"
          label="Developer"
          icon={Boxes}
          isActive={pathname === "/developer"}
          isCollapsed={isCollapsed}
        />
        <NavItem
          href="/battery"
          label="Battery"
          icon={BatteryMedium}
          isActive={pathname === "/battery"}
          isCollapsed={isCollapsed}
        />

        <SectionLabel isCollapsed={isCollapsed}>Locations</SectionLabel>
        {locations?.map((location) => {
          const Icon = LOCATION_ICONS[location.icon] ?? FileText;
          return (
            <NavItem
              key={location.path}
              href={explorerHref(location.path)}
              label={location.label}
              icon={Icon}
              isActive={isExplorerAt(location.path)}
              isCollapsed={isCollapsed}
            />
          );
        })}

        <SectionLabel isCollapsed={isCollapsed}>Drives</SectionLabel>
        {drives?.map((drive) => (
          <NavItem
            key={drive.mountPath}
            href={explorerHref(drive.mountPath)}
            label={drive.name}
            icon={HardDrive}
            isActive={isExplorerAt(drive.mountPath)}
            isCollapsed={isCollapsed}
          />
        ))}

        {isHydrated && favorites.length > 0 && (
          <>
            <SectionLabel isCollapsed={isCollapsed}>Favorites</SectionLabel>
            {favorites.map((favorite) => (
              <NavItem
                key={favorite}
                href={explorerHref(favorite)}
                label={favorite.split("/").filter(Boolean).pop() ?? favorite}
                icon={Star}
                isActive={isExplorerAt(favorite)}
                isCollapsed={isCollapsed}
              />
            ))}
          </>
        )}

        {isHydrated && savedSearches.length > 0 && !isCollapsed && (
          <>
            <SectionLabel isCollapsed={isCollapsed}>Saved Searches</SectionLabel>
            {savedSearches.map((search) => {
              const params = new URLSearchParams({ path: search.root, q: search.query, mode: search.mode });
              if (search.caseSensitive) params.set("case", "1");
              return (
                <div key={search.id} className="group flex items-center">
                  <Link
                    href={`/explorer?${params}`}
                    className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                  >
                    <Search className="size-4 shrink-0" aria-hidden />
                    <span className="truncate">{search.name}</span>
                  </Link>
                  <button
                    type="button"
                    aria-label={`Remove saved search ${search.name}`}
                    className="mr-1 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-sidebar-accent focus-visible:opacity-100 group-hover:opacity-100"
                    onClick={() => removeSavedSearch(search.id)}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </div>
              );
            })}
          </>
        )}

        <SectionLabel isCollapsed={isCollapsed}>System</SectionLabel>
        <NavItem
          href="/settings"
          label="Settings"
          icon={Settings}
          isActive={pathname === "/settings"}
          isCollapsed={isCollapsed}
        />
      </nav>

      <div className="border-t p-3">
        {rootDrive && !isCollapsed && (
          <div className="mb-3 space-y-1.5">
            <div className="flex items-baseline justify-between text-xs">
              <span className="font-medium">{rootDrive.name}</span>
              <span className="text-muted-foreground">{formatPercent(rootDrive.usedPercent)} used</span>
            </div>
            <Progress value={rootDrive.usedPercent * 100} aria-label={`${rootDrive.name} usage`} />
            <p className="text-[11px] text-muted-foreground">
              {formatBytes(rootDrive.freeBytes, unitSystem)} free of {formatBytes(rootDrive.totalBytes, unitSystem)}
            </p>
          </div>
        )}
        <Separator className="mb-2" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-center text-muted-foreground"
          onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronsRight className="size-4" aria-hidden /> : <ChevronsLeft className="size-4" aria-hidden />}
          {!isCollapsed && <span className="ml-1.5 text-xs">Collapse</span>}
        </Button>
      </div>
    </aside>
  );
}
