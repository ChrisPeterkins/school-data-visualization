import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';

// Create SQLite database connection
const sqlite = new Database('./school_data.db');

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