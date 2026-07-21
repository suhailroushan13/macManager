import type { DevFolderCategory, FileCategory } from "@/types/fs";
import { getDb } from "./client";

const FOLDER_INDEX_COLLECTION = "folderIndex";
const ROOTS_COLLECTION = "scanRoots";
/** Distinct scanned roots kept at once. Rescanning a root replaces its docs in place (no growth); this bounds how many different drives/trees stay indexed. */
const MAX_STORED_ROOTS = 5;
const BATCH_SIZE = 1000;

export interface FolderIndexDoc {
  path: string;
  parentPath: string | null;
  root: string;
  name: string;
  devCategory: DevFolderCategory | null;
  bytes: number;
  files: number;
  categoryBreakdown: { category: FileCategory; bytes: number; files: number }[];
  /** The folder's own mtime at index time — used to detect "contents changed" on rescan. */
  modifiedAt: number;
  lastIndexed: number;
}

let indexesEnsured = false;
async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db = await getDb();
  if (!db) return;
  await db.collection(FOLDER_INDEX_COLLECTION).createIndex({ path: 1 }, { unique: true });
  await db.collection(FOLDER_INDEX_COLLECTION).createIndex({ root: 1 });
  indexesEnsured = true;
}

/** Loads the full stored folder index for a root, keyed by path, for incremental-rescan comparison. */
export async function loadFolderIndex(root: string): Promise<Map<string, FolderIndexDoc>> {
  try {
    const db = await getDb();
    if (!db) return new Map();
    const docs = await db.collection<FolderIndexDoc>(FOLDER_INDEX_COLLECTION).find({ root }).toArray();
    return new Map(docs.map((doc) => [doc.path, doc]));
  } catch (error) {
    console.error("[db] Failed to load folder index:", error instanceof Error ? error.message : error);
    return new Map();
  }
}

/** Single-folder lookup used by the directory listing API to show folder sizes without loading the whole index. */
export async function findFolderIndexEntry(dirPath: string): Promise<FolderIndexDoc | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    return await db.collection<FolderIndexDoc>(FOLDER_INDEX_COLLECTION).findOne({ path: dirPath });
  } catch (error) {
    console.error("[db] Failed to look up folder:", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Persists a scan's folder index: upserts every doc (batched), deletes paths that no longer exist
 * (renamed/removed since the last index), then prunes the oldest roots beyond MAX_STORED_ROOTS so
 * the collection never grows without bound.
 */
export async function saveFolderIndex(root: string, docs: FolderIndexDoc[], stalePaths: string[]): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await ensureIndexes();
    const collection = db.collection<FolderIndexDoc>(FOLDER_INDEX_COLLECTION);

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = docs.slice(i, i + BATCH_SIZE);
      await collection.bulkWrite(
        batch.map((doc) => ({
          updateOne: { filter: { path: doc.path }, update: { $set: doc }, upsert: true },
        })),
      );
    }
    for (let i = 0; i < stalePaths.length; i += BATCH_SIZE) {
      await collection.deleteMany({ path: { $in: stalePaths.slice(i, i + BATCH_SIZE) } });
    }

    await db.collection(ROOTS_COLLECTION).replaceOne({ root }, { root, lastScannedAt: Date.now() }, { upsert: true });
    const roots = await db.collection<{ root: string; lastScannedAt: number }>(ROOTS_COLLECTION)
      .find({})
      .sort({ lastScannedAt: -1 })
      .toArray();
    const staleRoots = roots.slice(MAX_STORED_ROOTS).map((entry) => entry.root);
    if (staleRoots.length > 0) {
      await collection.deleteMany({ root: { $in: staleRoots } });
      await db.collection(ROOTS_COLLECTION).deleteMany({ root: { $in: staleRoots } });
    }
  } catch (error) {
    console.error("[db] Failed to save folder index:", error instanceof Error ? error.message : error);
  }
}
