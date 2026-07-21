import type { Metadata } from "next";
import { Duplicates } from "@/features/duplicates/duplicates";

export const metadata: Metadata = {
  title: "Duplicate Finder",
  description: "Find files with identical content and reclaim disk space.",
};

export default function DuplicatesPage() {
  return <Duplicates />;
}
