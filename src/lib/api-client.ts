import type {
  ApiError,
  BatteryInfo,
  DirListing,
  DriveInfo,
  DuplicateProgress,
  DuplicateResult,
  QuickLocation,
  ScanMode,
  ScanProgress,
  ScanResult,
  SearchMode,
  SearchResponse,
} from "@/types/fs";

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let error: ApiError = { code: "INTERNAL", message: "Request failed." };
    try {
      error = (await response.json()) as ApiError;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new ApiRequestError(error.code, error.message, response.status);
  }
  return (await response.json()) as T;
}

export const api = {
  drives: () => request<DriveInfo[]>("/api/drives"),
  battery: () => request<BatteryInfo | null>("/api/battery"),
  locations: () => request<QuickLocation[]>("/api/locations"),
  list: (path: string) => request<DirListing>(`/api/list?path=${encodeURIComponent(path)}`),
  search: (params: {
    root: string;
    query: string;
    mode: SearchMode;
    caseSensitive: boolean;
    includeHidden: boolean;
  }) => {
    const searchParams = new URLSearchParams({
      root: params.root,
      q: params.query,
      mode: params.mode,
      caseSensitive: String(params.caseSensitive),
      includeHidden: String(params.includeHidden),
    });
    return request<SearchResponse>(`/api/search?${searchParams}`);
  },
  scanResult: () => request<ScanResult>("/api/scan"),
  startScan: (root: string, mode: ScanMode = "full") =>
    request<ScanProgress>("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, mode }),
    }),
  controlScan: (action: "pause" | "resume" | "cancel") =>
    request<ScanProgress>("/api/scan", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }),
  duplicateResult: () => request<DuplicateResult>("/api/duplicates"),
  startDuplicates: (root: string, minSize: number) =>
    request<DuplicateProgress>("/api/duplicates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root, minSize }),
    }),
  cancelDuplicates: () =>
    request<DuplicateProgress>("/api/duplicates", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel" }),
    }),
  fileOp: (action: "open" | "reveal" | "terminal" | "trash" | "rename", paths: string[], newName?: string) =>
    request<{ ok: boolean; newPath?: string }>("/api/ops", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, paths, newName }),
    }),
};
