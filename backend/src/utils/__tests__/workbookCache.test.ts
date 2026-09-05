import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { readWorkbookRows } from '../workbookCache';

function writeWorkbook(dir: string, name: string, rows: any[][]): string {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'PSSA');
  const file = path.join(dir, name);
  XLSX.writeFile(wb, file);
  return file;
}

describe('readWorkbookRows', () => {
  it('parses once, then serves the cached rows keyed by header row', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wbcache-'));
    const file = writeWorkbook(dir, 'sample.xlsx', [
      ['title row'], [], [],
      ['Year', 'Grade', 'Percent'],
      [2025, 3, 41.5],
      [2025, 'Total', 45.7],
    ]);

    const first = readWorkbookRows(file, 3);
    expect(first.fromCache).toBe(false);
    expect(first.rows).toHaveLength(2);
    expect(first.rows[1]).toMatchObject({ Grade: 'Total', Percent: 45.7 });

    const second = readWorkbookRows(file, 3);
    expect(second.fromCache).toBe(true);
    expect(second.rows).toEqual(first.rows);
    expect(fs.readdirSync(path.join(dir, '.cache')).some((f) => f.endsWith('.json.gz'))).toBe(true);
  });

  it('re-parses when the file changes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wbcache-'));
    const file = writeWorkbook(dir, 'sample.xlsx', [['A'], [1]]);
    readWorkbookRows(file, 0);
    // A different size changes the cache key, so the stale entry is ignored and replaced.
    writeWorkbook(dir, 'sample.xlsx', [['A'], [1], [2], [3]]);
    const again = readWorkbookRows(file, 0);
    expect(again.fromCache).toBe(false);
    expect(again.rows).toHaveLength(3);
  });
});
