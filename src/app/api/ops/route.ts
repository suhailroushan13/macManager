import { NextRequest, NextResponse } from "next/server";
import { moveToTrash, openInSystem, openTerminalAt, renameItem, revealInFinder } from "@/server/fs/operations";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OpsBody {
  action?: unknown;
  paths?: unknown;
  newName?: unknown;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** POST { action, paths, newName? } — open / reveal / terminal / trash / rename. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as OpsBody;
    const action = typeof body.action === "string" ? body.action : "";
    const paths = stringArray(body.paths);
    if (paths.length === 0) {
      return NextResponse.json({ code: "INVALID_PATHS", message: "At least one path is required." }, { status: 400 });
    }

    switch (action) {
      case "open":
        await openInSystem(paths[0]);
        return NextResponse.json({ ok: true });
      case "reveal":
        await revealInFinder(paths[0]);
        return NextResponse.json({ ok: true });
      case "terminal":
        await openTerminalAt(paths[0]);
        return NextResponse.json({ ok: true });
      case "trash":
        await moveToTrash(paths);
        return NextResponse.json({ ok: true });
      case "rename": {
        const newName = typeof body.newName === "string" ? body.newName : "";
        const newPath = await renameItem(paths[0], newName);
        return NextResponse.json({ ok: true, newPath });
      }
      default:
        return NextResponse.json({ code: "INVALID_ACTION", message: "Unknown action." }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
