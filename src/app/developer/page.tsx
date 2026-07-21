import type { Metadata } from "next";
import { DeveloperFolders } from "@/features/developer/developer-folders";

export const metadata: Metadata = {
  title: "Developer Folders",
  description: "The largest node_modules, build output, caches, and virtual environments found by the last scan.",
};

export default function DeveloperPage() {
  return <DeveloperFolders />;
}
