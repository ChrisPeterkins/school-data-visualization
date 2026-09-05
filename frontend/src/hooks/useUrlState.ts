import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Keep a piece of page state in the URL query string so filters survive a
 * reload and can be shared. `parse` turns the raw string into the value;
 * `serialize` turns a value back (return '' to drop the key).
 */
export function useUrlState<T>(
  key: string,
  fallback: T,
  parse: (raw: string) => T | null,
  serialize: (value: T) => string = (v) => String(v ?? ''),
): [T, (value: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const parsed = raw != null ? parse(raw) : null;
  const value = parsed ?? fallback;

  const setValue = useCallback((next: T) => {
    setParams((prev) => {
      const out = new URLSearchParams(prev);
      const s = serialize(next);
      if (s === '' || s === serialize(fallback)) out.delete(key); else out.set(key, s);
      return out;
    }, { replace: true });
  }, [key, setParams, serialize, fallback]);

  return [value, setValue];
}

export const parseNumber = (raw: string): number | null => {
  const n = Number(raw);
  return raw !== '' && Number.isFinite(n) ? n : null;
};
export const parseString = (raw: string): string | null => (raw === '' ? null : raw);
export const parseNumberList = (raw: string): number[] | null => {
  const ids = raw.split(',').map(Number).filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? ids : null;
};
