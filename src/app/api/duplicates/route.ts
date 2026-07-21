import { NextRequest, NextResponse } from "next/server";
import { getDuplicateEngine, pruneMissingFiles } from "@/server/fs/duplicates";
import { loadLatestDuplicateResult } from "@/server/db/results-store";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MIN_SIZE = 1024 * 1024;

/**
 * GET returns duplicate-scan progress and groups for polling. When no run has
 * happened in this process, the last persisted result is served instead.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const result = getDuplicateEngine().result();
    if (result.progress.state === "idle") {
      const persisted = await loadLatestDuplicateResult();
      if (persisted) return NextResponse.json(await pruneMissingFiles(persisted));
    }
    // Groups are a snapshot from the last scan — drop entries already trashed
    // since then so the list always reflects what's actually still on disk.
    if (result.progress.state !== "running") return NextResponse.json(await pruneMissingFiles(result));
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

/** POST { root, minSize? } starts a duplicate scan. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const record = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
    const root = typeof record.root === "string" ? record.root : "";
    const minSizeRaw = Number(record.minSize);
    const minSize = Number.isFinite(minSizeRaw) && minSizeRaw >= 0 ? minSizeRaw : DEFAULT_MIN_SIZE;
    await getDuplicateEngine().start(root, minSize);
    return NextResponse.json(getDuplicateEngine().progress(), { status: 202 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("already in progress")) {
      return NextResponse.json({ code: "DUPLICATES_RUNNING", message: error.message }, { status: 409 });
    }
    return errorResponse(error);
  }
}

/** PATCH { action: "cancel" } cancels the running duplicate scan. */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json();
    const action =
      typeof body === "object" && body !== null && "action" in body
        ? String((body as { action: unknown }).action)
        : "";
    if (action !== "cancel") {
      return NextResponse.json({ code: "INVALID_ACTION", message: "Action must be cancel." }, { status: 400 });
    }
    getDuplicateEngine().cancel();
    return NextResponse.json(getDuplicateEngine().progress());
  } catch (error) {
    return errorResponse(error);
  }
}
