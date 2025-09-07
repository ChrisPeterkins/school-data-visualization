import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './newSchema';

// Create SQLite database connection - using the correct database with new schema
const sqlite = new Database('./school-data.db');

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