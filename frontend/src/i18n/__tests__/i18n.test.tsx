import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { I18nProvider, useI18n, useT } from '../index';
import { en } from '../en';
import { es } from '../es';

function Probe() {
  const t = useT();
  const { lang, setLang } = useI18n();
  return (
    <div>
      <span data-testid="title">{t('nav.schools')}</span>
      <span data-testid="vars">{t('footer.asOf', { date: 'X' })}</span>
      <span data-testid="missing">{t('no.such.key')}</span>
      <span data-testid="lang">{lang}</span>
      <button onClick={() => setLang('es')}>es</button>
    </div>
  );
}

describe('i18n', () => {
  it('translates, fills placeholders, and falls back to the key', () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    expect(screen.getByTestId('title')).toHaveTextContent('Schools');
    expect(screen.getByTestId('vars')).toHaveTextContent('Data as of X.');
    expect(screen.getByTestId('missing')).toHaveTextContent('no.such.key');
  });

  it('switches language, persists it, and sets <html lang>', () => {
    render(<I18nProvider><Probe /></I18nProvider>);
    fireEvent.click(screen.getByText('es'));
    expect(screen.getByTestId('title')).toHaveTextContent('Escuelas');
    expect(localStorage.getItem('paschools.lang')).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('has a Spanish string for every English key', () => {
    const missing = Object.keys(en).filter((k) => !(k in es));
    expect(missing).toEqual([]);
  });
});
