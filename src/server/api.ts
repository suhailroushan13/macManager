import { NextResponse } from "next/server";
import { PathError } from "./fs/paths";

/** Uniform JSON error envelope: { code, message } with a correct status code. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof PathError) {
    const status = error.code === "NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ code: error.code, message: error.message }, { status });
  }
  if (error instanceof Error && /EACCES|EPERM/.test(error.message)) {
    return NextResponse.json(
      { code: "PERMISSION_DENIED", message: "Permission denied for this location." },
      { status: 403 },
    );
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return NextResponse.json({ code: "INTERNAL", message }, { status: 500 });
}
