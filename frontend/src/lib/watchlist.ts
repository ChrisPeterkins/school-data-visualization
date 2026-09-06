import { useCallback, useEffect, useState } from 'react';

export interface Pin { kind: 'school' | 'district'; id: number; name: string; detail?: string }
const KEY = 'paschools.pins';
const SEEN_KEY = 'paschools.lastSeenImport';
const listeners = new Set<() => void>();

export function readPins(): Pin[] {
  try { const raw = localStorage.getItem(KEY); const v = raw ? JSON.parse(raw) : []; return Array.isArray(v) ? v : []; } catch { return []; }
}
function writePins(pins: Pin[]) {
  try { localStorage.setItem(KEY, JSON.stringify(pins)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

/** Pinned schools and districts, kept in this browser only. */
export function usePins() {
  const [pins, setPins] = useState<Pin[]>(readPins);
  useEffect(() => { const l = () => setPins(readPins()); listeners.add(l); return () => { listeners.delete(l); }; }, []);
  const isPinned = useCallback((kind: Pin['kind'], id: number) => pins.some((p) => p.kind === kind && p.id === id), [pins]);
  const toggle = useCallback((pin: Pin) => {
    const cur = readPins();
    const next = cur.some((p) => p.kind === pin.kind && p.id === pin.id) ? cur.filter((p) => !(p.kind === pin.kind && p.id === pin.id)) : [...cur, pin].slice(-30);
    writePins(next);
  }, []);
  const remove = useCallback((kind: Pin['kind'], id: number) => writePins(readPins().filter((p) => !(p.kind === kind && p.id === id))), []);
  return { pins, isPinned, toggle, remove };
}

/** The last import timestamp the visitor has seen, to flag new data. */
export function lastSeenImport(): string | null { try { return localStorage.getItem(SEEN_KEY); } catch { return null; } }
export function markImportSeen(iso: string) { try { localStorage.setItem(SEEN_KEY, iso); } catch { /* ignore */ } }
