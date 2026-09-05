import { useEffect } from 'react';

const SITE = 'PA School Data';

/**
 * Per-page browser title and description so tabs, history, and shared links
 * say what the page is instead of the site name alone.
 */
export function useDocumentTitle(title: string | null | undefined, description?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : `${SITE} · Pennsylvania School Data Explorer`;
    const desc = description || 'PSSA and Keystone exam results, growth, and trends for every public school in Pennsylvania.';
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
      const el = document.querySelector<HTMLMetaElement>(selector);
      if (el) el.content = desc;
    }
    const og = document.querySelector<HTMLMetaElement>('meta[property="og:title"]');
    if (og) og.content = document.title;
    const url = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
    if (url) url.content = window.location.href;
  }, [title, description]);
}
