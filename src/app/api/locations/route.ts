import { NextResponse } from "next/server";
import { listQuickLocations } from "@/server/fs/locations";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await listQuickLocations());
  } catch (error) {
    return errorResponse(error);
  }
}
