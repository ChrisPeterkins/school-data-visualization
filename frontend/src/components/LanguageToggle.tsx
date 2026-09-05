import { useI18n } from '../i18n';

/** EN / ES switch; the choice is remembered in the browser. */
export default function LanguageToggle({ dark = true }: { dark?: boolean }) {
  const { lang, setLang, t } = useI18n();
  const base = dark ? 'text-navy-300 hover:text-white' : 'text-stone-500 hover:text-stone-900';
  const active = dark ? 'text-gold-400' : 'text-navy-800';
  return (
    <div className="inline-flex items-center gap-1 text-xs font-medium" role="group" aria-label={t('nav.language')}>
      {(['en', 'es'] as const).map((l, i) => (
        <span key={l} className="inline-flex items-center">
          {i > 0 && <span className={`px-0.5 ${dark ? 'text-navy-600' : 'text-stone-300'}`}>/</span>}
          <button type="button" onClick={() => setLang(l)} aria-pressed={lang === l} lang={l} className={`px-1 py-0.5 rounded ${lang === l ? active : base}`}>
            {l.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
