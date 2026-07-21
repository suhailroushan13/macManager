import type { FileCategory } from "@/types/fs";

const CATEGORY_BY_EXTENSION: Record<string, FileCategory> = {};

function register(category: FileCategory, extensions: string[]): void {
  for (const extension of extensions) CATEGORY_BY_EXTENSION[extension] = category;
}

register("image", ["jpg", "jpeg", "png", "gif", "webp", "heic", "heif", "tiff", "tif", "bmp", "svg", "ico", "raw", "cr2", "nef", "arw", "avif", "psd", "ai"]);
register("video", ["mp4", "mov", "mkv", "avi", "webm", "m4v", "wmv", "flv", "mpg", "mpeg", "3gp", "ts"]);
register("audio", ["mp3", "wav", "aac", "flac", "ogg", "m4a", "aiff", "aif", "wma", "opus", "mid", "midi"]);
register("document", ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "rtf", "odt", "ods", "odp", "pages", "numbers", "key", "csv", "epub", "tex"]);
register("archive", ["zip", "tar", "gz", "bz2", "xz", "7z", "rar", "tgz", "dmg", "iso", "pkg", "xip", "zst", "lz4"]);
register("code", ["js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "c", "h", "cpp", "hpp", "cs", "java", "kt", "swift", "m", "mm", "php", "sh", "zsh", "bash", "json", "yaml", "yml", "toml", "xml", "html", "css", "scss", "sql", "graphql", "proto", "vue", "svelte", "lua", "pl", "r", "dart"]);
register("application", ["app", "exe", "bin", "appimage", "deb", "rpm", "msi", "ipa", "apk", "dylib", "so", "dll", "framework"]);

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function categorize(name: string, isDirectory: boolean): FileCategory {
  if (isDirectory) return "other";
  return CATEGORY_BY_EXTENSION[extensionOf(name)] ?? "other";
}

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  image: "Images",
  video: "Videos",
  audio: "Audio",
  document: "Documents",
  archive: "Archives",
  code: "Code",
  application: "Applications",
  other: "Other",
};
