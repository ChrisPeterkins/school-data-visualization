/**
 * Cached workbook reader. SheetJS needs 20-45 s to parse PDE's 100k-row
 * workbooks, and the import, backfill, and verify scripts all re-read the same
 * files. The first read writes the parsed rows as gzipped JSON next to the
 * source in a `.cache/` folder beside it; later reads load that in well under a second.
 * The cache key includes the file's size and mtime plus the header row, so a
 * replaced file is re-parsed automatically.
 */
import * as XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const CACHE_DIR_NAME = '.cache';

function cachePath(filePath: string, headerRow: number | undefined): string {
  const stat = fs.statSync(filePath);
  const dir = path.join(path.dirname(filePath), CACHE_DIR_NAME);
  const tag = `${stat.size}-${Math.floor(stat.mtimeMs)}-h${headerRow ?? 'auto'}`;
  return path.join(dir, `${path.basename(filePath)}.${tag}.json.gz`);
}

export interface WorkbookRows {
  rows: any[];
  sheetName: string;
  fromCache: boolean;
}

/** Rows of the first sheet as header-keyed objects, like XLSX.utils.sheet_to_json. */
export function readWorkbookRows(filePath: string, headerRow?: number): WorkbookRows {
  const cached = cachePath(filePath, headerRow);
  if (fs.existsSync(cached)) {
    try {
      const parsed = JSON.parse(zlib.gunzipSync(fs.readFileSync(cached)).toString('utf8'));
      return { rows: parsed.rows, sheetName: parsed.sheetName, fromCache: true };
    } catch {
      // fall through and re-parse
    }
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], headerRow != null ? { range: headerRow } : undefined);

  try {
    fs.mkdirSync(path.dirname(cached), { recursive: true });
    // Clear stale entries for the same source file before writing the new one.
    for (const f of fs.readdirSync(path.dirname(cached))) {
      if (f.startsWith(path.basename(filePath) + '.') && f !== path.basename(cached)) {
        fs.unlinkSync(path.join(path.dirname(cached), f));
      }
    }
    fs.writeFileSync(cached, zlib.gzipSync(Buffer.from(JSON.stringify({ sheetName, rows })), { level: 6 }));
  } catch {
    // A read-only sources directory just means no cache; parsing still worked.
  }
  return { rows, sheetName, fromCache: false };
}
