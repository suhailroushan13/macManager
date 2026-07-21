"use client";

import { useTheme } from "next-themes";
import { useHydrated } from "@/hooks/use-hydrated";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore, type DevFolderFilters } from "@/store/settings-store";
import type { UnitSystem } from "@/lib/format";

const DEV_FILTER_ROWS: { key: keyof DevFolderFilters; label: string; description: string }[] = [
  { key: "hideNodeModules", label: "Hide node_modules", description: "Hide dependency folders (node_modules, vendor, Pods)." },
  { key: "hideBuild", label: "Hide build folders", description: "Hide build output (dist, build, .next, target, …)." },
  { key: "hideCache", label: "Hide cache folders", description: "Hide package-manager and tool caches." },
  { key: "hideVenv", label: "Hide virtual environments", description: "Hide venv / .venv folders." },
  { key: "hideGenerated", label: "Hide generated files", description: "Hide lockfiles, source maps, and .DS_Store." },
];

function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  );
}

export function Settings() {
  const { theme, setTheme } = useTheme();
  const isMounted = useHydrated();
  const unitSystem = useSettingsStore((state) => state.unitSystem);
  const setUnitSystem = useSettingsStore((state) => state.setUnitSystem);
  const showHidden = useSettingsStore((state) => state.showHidden);
  const setShowHidden = useSettingsStore((state) => state.setShowHidden);
  const devFilters = useSettingsStore((state) => state.devFilters);
  const setDevFilter = useSettingsStore((state) => state.setDevFilter);

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Appearance, units, and browsing preferences.</p>
      </div>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm">Appearance</CardTitle>
          <CardDescription className="text-xs">Theme follows your system by default.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Theme"
            description="Light, dark, or match the system."
            control={
              isMounted ? (
                <Select value={theme ?? "system"} onValueChange={setTheme}>
                  <SelectTrigger className="w-32" aria-label="Theme">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="h-9 w-32 rounded-md border" />
              )
            }
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm">Files & units</CardTitle>
          <CardDescription className="text-xs">How sizes and hidden files are displayed.</CardDescription>
        </CardHeader>
        <CardContent>
          <SettingRow
            label="Size units"
            description="Decimal (GB, like Finder) or binary (GiB)."
            control={
              <Select value={unitSystem} onValueChange={(value) => setUnitSystem(value as UnitSystem)}>
                <SelectTrigger className="w-36" aria-label="Size units">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="decimal">Decimal (GB)</SelectItem>
                  <SelectItem value="binary">Binary (GiB)</SelectItem>
                </SelectContent>
              </Select>
            }
          />
          <Separator />
          <SettingRow
            label="Show hidden files"
            description="Include dotfiles in folder listings."
            control={
              <div className="flex items-center gap-2">
                <Switch id="settings-hidden" checked={showHidden} onCheckedChange={setShowHidden} />
                <Label htmlFor="settings-hidden" className="sr-only">
                  Show hidden files
                </Label>
              </div>
            }
          />
        </CardContent>
      </Card>

      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle className="text-sm">Developer folders</CardTitle>
          <CardDescription className="text-xs">
            These only hide items in the view — everything is still fully scanned and indexed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {DEV_FILTER_ROWS.map((row, index) => (
            <div key={row.key}>
              {index > 0 && <Separator />}
              <SettingRow
                label={row.label}
                description={row.description}
                control={
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`settings-${row.key}`}
                      checked={devFilters[row.key]}
                      onCheckedChange={(checked) => setDevFilter(row.key, checked)}
                    />
                    <Label htmlFor={`settings-${row.key}`} className="sr-only">
                      {row.label}
                    </Label>
                  </div>
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
