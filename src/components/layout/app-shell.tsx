"use client";

import { Suspense, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { StatusBar } from "./status-bar";

/* Sidebar and Header read useSearchParams, which requires a Suspense boundary. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full">
      <Suspense fallback={<div className="w-60 shrink-0 border-r bg-sidebar" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-14 shrink-0 border-b" />}>
          <Header />
        </Suspense>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        <StatusBar />
      </div>
    </div>
  );
}
