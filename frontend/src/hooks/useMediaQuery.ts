import { useEffect, useState } from 'react';

/** True when the CSS media query matches. Re-evaluates on resize. */
export function useMediaQuery(query: string): boolean {
  const getMatch = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(getMatch);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Tailwind `sm` breakpoint and up. */
export function useIsSmUp(): boolean {
  return useMediaQuery('(min-width: 640px)');
}
