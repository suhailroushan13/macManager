import { describe, expect, it } from "vitest";
import { categorize, extensionOf } from "./file-category";

describe("extensionOf", () => {
  it("extracts lowercase extensions", () => {
    expect(extensionOf("Photo.JPG")).toBe("jpg");
    expect(extensionOf("archive.tar.gz")).toBe("gz");
  });

  it("handles names without a usable extension", () => {
    expect(extensionOf("Makefile")).toBe("");
    expect(extensionOf(".gitignore")).toBe("");
    expect(extensionOf("trailing.")).toBe("");
  });
});

describe("categorize", () => {
  it("maps known extensions to categories", () => {
    expect(categorize("movie.mp4", false)).toBe("video");
    expect(categorize("song.flac", false)).toBe("audio");
    expect(categorize("report.pdf", false)).toBe("document");
    expect(categorize("backup.zip", false)).toBe("archive");
    expect(categorize("index.tsx", false)).toBe("code");
  });

  it("falls back to other for unknown extensions and directories", () => {
    expect(categorize("mystery.xyz", false)).toBe("other");
    expect(categorize("Documents", true)).toBe("other");
  });
});
