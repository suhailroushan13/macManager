import os from "node:os";
import path from "node:path";
import { access } from "node:fs/promises";
import type { QuickLocation } from "@/types/fs";

const HOME_FOLDERS: Array<{ label: string; folder: string; icon: string }> = [
  { label: "Home", folder: "", icon: "home" },
  { label: "Downloads", folder: "Downloads", icon: "download" },
  { label: "Documents", folder: "Documents", icon: "file-text" },
  { label: "Pictures", folder: "Pictures", icon: "image" },
  { label: "Videos", folder: "Movies", icon: "video" },
  { label: "Music", folder: "Music", icon: "music" },
  { label: "Desktop", folder: "Desktop", icon: "monitor" },
  { label: "Trash", folder: ".Trash", icon: "trash-2" },
];

/** Returns the user's standard folders, skipping any that don't exist. */
export async function listQuickLocations(): Promise<QuickLocation[]> {
  const home = os.homedir();
  const locations = await Promise.all(
    HOME_FOLDERS.map(async ({ label, folder, icon }): Promise<QuickLocation | null> => {
      // turbopackIgnore: runtime user-home paths are not build assets to trace.
      const target = folder ? path.join(/*turbopackIgnore: true*/ home, folder) : home;
      try {
        await access(target);
        return { label, path: target, icon };
      } catch {
        return null;
      }
    }),
  );
  return locations.filter((location): location is QuickLocation => location !== null);
}
