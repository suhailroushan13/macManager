import { NextResponse } from "next/server";
import { readBattery } from "@/server/fs/battery";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json(await readBattery());
  } catch (error) {
    return errorResponse(error);
  }
}
