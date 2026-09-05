import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';
import * as schema from './newSchema';

// Create SQLite database connection - using the correct database with new schema
// DATABASE_PATH lets tests and CI point at a fixture database; production
// keeps the file beside the backend.
const sqlite = new Database(process.env.DATABASE_PATH || './school-data.db');

// Export the raw SQLite instance for direct SQL access when needed
export const sqliteDb: BetterSqlite3.Database = sqlite;

// For compatibility with existing code that expects a pool
export const pool = {
  query: async (sql: string) => {
    return sqlite.prepare(sql).all();
  },
  end: async () => {
    sqlite.close();
  }
};

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;