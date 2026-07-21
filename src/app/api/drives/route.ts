import { NextResponse } from "next/server";
import { listDrives } from "@/server/fs/drives";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await listDrives());
  } catch (error) {
    return errorResponse(error);
  }
}
