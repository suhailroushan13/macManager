"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SavedSearch } from "@/types/fs";
import type { UnitSystem } from "@/lib/format";

/** UI-only visibility toggles for developer folders. Scanning is never affected — these just hide rows. */
export interface DevFolderFilters {
  hideNodeModules: boolean;
  hideBuild: boolean;
  hideCache: boolean;
  hideVenv: boolean;
  hideGenerated: boolean;
}

const DEFAULT_DEV_FILTERS: DevFolderFilters = {
  hideNodeModules: false,
  hideBuild: false,
  hideCache: false,
  hideVenv: false,
  hideGenerated: false,
};

interface SettingsState {
  unitSystem: UnitSystem;
  showHidden: boolean;
  favorites: string[];
  savedSearches: SavedSearch[];
  devFilters: DevFolderFilters;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  setShowHidden: (showHidden: boolean) => void;
  toggleFavorite: (path: string) => void;
  addSavedSearch: (search: Omit<SavedSearch, "id">) => void;
  removeSavedSearch: (id: string) => void;
  setDevFilter: (key: keyof DevFolderFilters, value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      unitSystem: "decimal",
      showHidden: false,
      favorites: [],
      savedSearches: [],
      devFilters: DEFAULT_DEV_FILTERS,
      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setShowHidden: (showHidden) => set({ showHidden }),
      toggleFavorite: (path) =>
        set((state) => ({
          favorites: state.favorites.includes(path)
            ? state.favorites.filter((favorite) => favorite !== path)
            : [...state.favorites, path],
        })),
      addSavedSearch: (search) =>
        set((state) => ({
          savedSearches: [...state.savedSearches, { ...search, id: crypto.randomUUID() }],
        })),
      removeSavedSearch: (id) =>
        set((state) => ({
          savedSearches: state.savedSearches.filter((search) => search.id !== id),
        })),
      setDevFilter: (key, value) => set((state) => ({ devFilters: { ...state.devFilters, [key]: value } })),
    }),
    { name: "lfm-settings" },
  ),
);
