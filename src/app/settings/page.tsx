import type { Metadata } from "next";
import { Settings } from "@/features/settings/settings";

export const metadata: Metadata = {
  title: "Settings",
  description: "Configure theme, size units, and hidden-file visibility.",
};

export default function SettingsPage() {
  return <Settings />;
}
