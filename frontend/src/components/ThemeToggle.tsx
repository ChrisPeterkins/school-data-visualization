import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import { useT } from '../i18n';

type Pref = 'system' | 'light' | 'dark';
const ORDER: Pref[] = ['system', 'light', 'dark'];
const read = (): Pref => { try { const v = localStorage.getItem('theme'); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; } };

/** Apply a preference to <html>; mirrors public/theme.js, which runs before first paint. */
export function applyTheme(pref: Pref) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}

/** Cycles system → light → dark; remembered in the browser. */
export default function ThemeToggle({ dark = true }: { dark?: boolean }) {
  const t = useT();
  const [pref, setPref] = useState<Pref>(read);
  useEffect(() => {
    applyTheme(pref);
    try { localStorage.setItem('theme', pref); } catch { /* ignore */ }
    if (pref !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [pref]);
  const Icon = pref === 'dark' ? MoonIcon : pref === 'light' ? SunIcon : ComputerDesktopIcon;
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
  return (
    <button type="button" onClick={() => setPref(next)} title={t(`theme.${pref}`)} aria-label={`${t('theme.label')}: ${t(`theme.${pref}`)}. ${t('theme.switchTo', { next: t(`theme.${next}`) })}`}
      className={`inline-flex items-center justify-center w-7 h-7 rounded ${dark ? 'text-navy-300 hover:text-white' : 'text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 dark:text-stone-100'}`}>
      <Icon className="w-4 h-4" aria-hidden="true" />
    </button>
  );
}
