import type { Metadata } from "next";
import { LargeFiles } from "@/features/large-files/large-files";

export const metadata: Metadata = {
  title: "Large Files",
  description: "Find and clean up the largest files on your drives.",
};

export default function LargeFilesPage() {
  return <LargeFiles />;
}
