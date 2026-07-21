import type { DuplicateResult, ScanResult } from "@/types/fs";
import { getDb } from "./client";

const SCANS_COLLECTION = "scans";
const DUPLICATES_COLLECTION = "duplicates";
const MAX_STORED_RUNS = 10;

interface StoredRun<T> {
  savedAt: number;
  root: string;
  result: T;
}

async function saveRun<T>(collectionName: string, root: string, result: T): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const collection = db.collection<StoredRun<T>>(collectionName);
  await collection.insertOne({ savedAt: Date.now(), root, result });
  // Keep history bounded: drop everything beyond the newest MAX_STORED_RUNS.
  const stale = await collection
    .find({}, { projection: { _id: 1 } })
    .sort({ savedAt: -1 })
    .skip(MAX_STORED_RUNS)
    .toArray();
  if (stale.length > 0) {
    await collection.deleteMany({ _id: { $in: stale.map((doc) => doc._id) } });
  }
}

async function loadLatestRun<T>(collectionName: string): Promise<(T & { savedAt: number }) | null> {
  const db = await getDb();
  if (!db) return null;
  const doc = await db
    .collection<StoredRun<T>>(collectionName)
    .find({})
    .sort({ savedAt: -1 })
    .limit(1)
    .next();
  if (!doc) return null;
  return { ...doc.result, savedAt: doc.savedAt };
}

/** Persists a completed disk scan; failures are logged, never thrown. */
export async function saveScanResult(result: ScanResult): Promise<void> {
  try {
    await saveRun(SCANS_COLLECTION, result.progress.root ?? "", result);
  } catch (error) {
    console.error("[db] Failed to save scan result:", error instanceof Error ? error.message : error);
  }
}

export async function loadLatestScanResult(): Promise<ScanResult | null> {
  try {
    return await loadLatestRun<ScanResult>(SCANS_COLLECTION);
  } catch (error) {
    console.error("[db] Failed to load scan result:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Used to seed a rescan (largest-files list, etc.) with the previous result for the same root. */
export async function loadLatestScanResultForRoot(root: string): Promise<ScanResult | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const doc = await db
      .collection<StoredRun<ScanResult>>(SCANS_COLLECTION)
      .find({ root })
      .sort({ savedAt: -1 })
      .limit(1)
      .next();
    if (!doc) return null;
    return { ...doc.result, savedAt: doc.savedAt };
  } catch (error) {
    console.error("[db] Failed to load scan result for root:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** Persists a completed duplicate scan; failures are logged, never thrown. */
export async function saveDuplicateResult(result: DuplicateResult): Promise<void> {
  try {
    await saveRun(DUPLICATES_COLLECTION, result.progress.root ?? "", result);
  } catch (error) {
    console.error("[db] Failed to save duplicate result:", error instanceof Error ? error.message : error);
  }
}

export async function loadLatestDuplicateResult(): Promise<DuplicateResult | null> {
  try {
    return await loadLatestRun<DuplicateResult>(DUPLICATES_COLLECTION);
  } catch (error) {
    console.error("[db] Failed to load duplicate result:", error instanceof Error ? error.message : error);
    return null;
  }
}
