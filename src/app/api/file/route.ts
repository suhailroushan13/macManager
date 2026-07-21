import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { extensionOf } from "@/lib/file-category";
import { normalizeAbsolute } from "@/server/fs/paths";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024;

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  avif: "image/avif",
  heic: "image/heic",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  flac: "audio/flac",
  ogg: "audio/ogg",
  json: "application/json",
  txt: "text/plain",
  md: "text/plain",
  csv: "text/plain",
};

/** Streams file content for the preview panel, size-capped and typed by extension. */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const filePath = normalizeAbsolute(request.nextUrl.searchParams.get("path") ?? "");
    const info = await stat(filePath);
    if (!info.isFile()) {
      return NextResponse.json({ code: "NOT_A_FILE", message: "Only files can be previewed." }, { status: 400 });
    }
    if (info.size > MAX_PREVIEW_BYTES) {
      return NextResponse.json(
        { code: "TOO_LARGE", message: "File is too large to preview. Open it in its default app instead." },
        { status: 413 },
      );
    }
    const mime = MIME_BY_EXTENSION[extensionOf(filePath)] ?? "text/plain; charset=utf-8";
    const stream = Readable.toWeb(createReadStream(filePath)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": mime,
        "Content-Length": String(info.size),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
