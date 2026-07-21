import { NextRequest, NextResponse } from "next/server";
import type { SearchMode, SearchRequest } from "@/types/fs";
import { searchFiles } from "@/server/fs/search";
import { errorResponse } from "@/server/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SEARCH_MODES: SearchMode[] = ["contains", "startsWith", "endsWith", "regex", "fuzzy"];

function parseRequest(request: NextRequest): SearchRequest {
  const params = request.nextUrl.searchParams;
  const modeParam = params.get("mode") ?? "contains";
  const mode = SEARCH_MODES.includes(modeParam as SearchMode) ? (modeParam as SearchMode) : "contains";
  const extensions = params.get("extensions")?.split(",").map((extension) => extension.trim().toLowerCase()).filter(Boolean);
  return {
    root: params.get("root") ?? "",
    query: params.get("q") ?? "",
    mode,
    caseSensitive: params.get("caseSensitive") === "true",
    includeHidden: params.get("includeHidden") === "true",
    extensions,
    maxResults: Number(params.get("maxResults")) || undefined,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const parsed = parseRequest(request);
    if (parsed.query.trim().length === 0) {
      return NextResponse.json(
        { code: "INVALID_QUERY", message: "Search query is required." },
        { status: 400 },
      );
    }
    if (parsed.mode === "regex") {
      try {
        new RegExp(parsed.query);
      } catch {
        return NextResponse.json(
          { code: "INVALID_REGEX", message: "Invalid regular expression." },
          { status: 400 },
        );
      }
    }
    return NextResponse.json(await searchFiles(parsed));
  } catch (error) {
    return errorResponse(error);
  }
}
