import { Suspense } from "react";
import type { Metadata } from "next";
import { Explorer } from "@/features/explorer/explorer";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Explorer",
  description: "Browse folders and files, search, filter, sort, and preview anything on your drives.",
};

export default function ExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-2 p-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <Skeleton key={index} className="h-8 rounded-md" />
          ))}
        </div>
      }
    >
      <Explorer />
    </Suspense>
  );
}
