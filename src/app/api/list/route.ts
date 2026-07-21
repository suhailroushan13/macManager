import { NextRequest, NextResponse } from "next/server";
import { listDirectory } from "@/server/fs/entries";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const path = request.nextUrl.searchParams.get("path") ?? "";
    return NextResponse.json(await listDirectory(path));
  } catch (error) {
    return errorResponse(error);
  }
}
