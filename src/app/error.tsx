"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <AlertTriangle className="size-6 text-muted-foreground" aria-hidden />
      <p className="text-sm font-medium">Something went wrong</p>
      <p className="max-w-md text-xs text-muted-foreground">
        {error.message || "An unexpected error occurred while rendering this page."}
      </p>
      <Button size="sm" variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
