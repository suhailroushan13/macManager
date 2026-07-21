import { NextRequest, NextResponse } from "next/server";
import { getScanEngine } from "@/server/fs/scanner";
import { loadLatestScanResult } from "@/server/db/results-store";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET returns the full scan result (progress + aggregates) for polling.
 * When no scan has run in this process, the last persisted result is served
 * so a restart doesn't force a rescan.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const result = getScanEngine().result();
    if (result.progress.state === "idle") {
      const persisted = await loadLatestScanResult();
      if (persisted) return NextResponse.json(persisted);
    }
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST { root, mode? } starts a scan. mode "rescan" reuses unchanged folders from the stored index. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const root = typeof body === "object" && body !== null && "root" in body ? String((body as { root: unknown }).root) : "";
    const rawMode = typeof body === "object" && body !== null && "mode" in body ? String((body as { mode: unknown }).mode) : "full";
    const mode = rawMode === "rescan" ? "rescan" : "full";
    await getScanEngine().start(root, mode);
    return NextResponse.json(getScanEngine().progress(), { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already in progress")) {
      return NextResponse.json({ code: "SCAN_RUNNING", message: error.message }, { status: 409 });
    }
    return errorResponse(error);
  }
}

/** PATCH { action: "pause" | "resume" | "cancel" } controls the running scan. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const action = typeof body === "object" && body !== null && "action" in body ? String((body as { action: unknown }).action) : "";
    const engine = getScanEngine();
    if (action === "pause") engine.pause();
    else if (action === "resume") engine.resume();
    else if (action === "cancel") engine.cancel();
    else {
      return NextResponse.json(
        { code: "INVALID_ACTION", message: "Action must be pause, resume, or cancel." },
        { status: 400 },
      );
    }
    return NextResponse.json(engine.progress());
  } catch (error) {
    return errorResponse(error);
  }
}
