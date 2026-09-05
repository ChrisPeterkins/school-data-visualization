import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { en } from './en';
import { es } from './es';

export type Lang = 'en' | 'es';
type Dict = Record<string, string>;
const DICTS: Record<Lang, Dict> = { en, es };
const STORAGE_KEY = 'paschools.lang';

interface I18n {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate a key; `{name}` placeholders are filled from vars. Unknown keys fall back to English, then the key. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18n>({ lang: 'en', setLang: () => undefined, t: (k) => en[k] ?? k });

function detect(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'es') return stored;
  } catch { /* no storage */ }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detect);
  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(STORAGE_KEY, l); } catch { /* ignore */ }
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const t = useCallback((key: string, vars?: Record<string, string | number>) => {
    let s = DICTS[lang][key] ?? en[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
export const useT = () => useContext(I18nContext).t;
