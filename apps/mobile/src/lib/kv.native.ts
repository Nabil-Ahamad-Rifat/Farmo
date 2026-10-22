// Small persistent key-value store for the offline cache and outbox (phones):
// one SQLite table. Same functions as kv.ts (the web version).
import * as SQLite from 'expo-sqlite';
import type { KvRow } from './kv';

export type { KvRow } from './kv';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function db() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const d = await SQLite.openDatabaseAsync('farm-offline.db');
      await d.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, json TEXT NOT NULL, savedAt INTEGER NOT NULL);');
      return d;
    })();
  }
  return dbPromise;
}

export async function kvGet(key: string): Promise<KvRow | null> {
  return (await (await db()).getFirstAsync<KvRow>('SELECT key, json, savedAt FROM kv WHERE key = ?', key)) ?? null;
}

export async function kvSet(key: string, json: string): Promise<void> {
  await (await db()).runAsync('INSERT OR REPLACE INTO kv (key, json, savedAt) VALUES (?, ?, ?)', key, json, Date.now());
}

export async function kvDelete(key: string): Promise<void> {
  await (await db()).runAsync('DELETE FROM kv WHERE key = ?', key);
}

/** Every row whose key starts with prefix. */
export async function kvList(prefix: string): Promise<KvRow[]> {
  return (await db()).getAllAsync<KvRow>('SELECT key, json, savedAt FROM kv WHERE substr(key, 1, ?) = ?', prefix.length, prefix);
}

export async function kvDeletePrefix(prefix: string): Promise<void> {
  await (await db()).runAsync('DELETE FROM kv WHERE substr(key, 1, ?) = ?', prefix.length, prefix);
}
