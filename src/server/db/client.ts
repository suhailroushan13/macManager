import { MongoClient, type Db } from "mongodb";

/**
 * Lazy MongoDB singleton. The database is optional: when MONGODB_URI is unset
 * or unreachable, callers get null and the app runs from memory only.
 */
const globalStore = globalThis as typeof globalThis & {
  __mongoClientPromise?: Promise<MongoClient | null>;
};

async function connect(): Promise<MongoClient | null> {
  const uri = process.env.MONGODB_URI;
  if (!uri) return null;
  try {
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });
    await client.connect();
    return client;
  } catch (error) {
    console.error(
      "[db] MongoDB unavailable, persistence disabled:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function getDb(): Promise<Db | null> {
  globalStore.__mongoClientPromise ??= connect();
  const client = await globalStore.__mongoClientPromise;
  if (!client) {
    // Allow a later retry instead of caching the failure forever.
    globalStore.__mongoClientPromise = undefined;
    return null;
  }
  return client.db("drivespace");
}
