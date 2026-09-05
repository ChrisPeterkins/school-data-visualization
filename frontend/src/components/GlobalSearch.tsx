import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { searchApi, type SearchHit } from '../services/api';

const KIND_LABEL: Record<SearchHit['kind'], string> = { school: 'School', district: 'District', county: 'County' };
const pathFor = (h: SearchHit) => (h.kind === 'school' ? `/schools/${h.id}` : h.kind === 'district' ? `/districts/${h.id}` : `/counties/${h.id}`);

/** Nav search with autocomplete across schools, districts, and counties. */
export default function GlobalSearch({ onNavigate, autoFocus = false, className = '' }: { onNavigate?: () => void; autoFocus?: boolean; className?: string }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [debounced, setDebounced] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(term.trim()), 150); return () => clearTimeout(t); }, [term]);
  useEffect(() => {
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const { data: hits = [] } = useQuery({
    queryKey: ['global-search', debounced],
    queryFn: () => searchApi.search(debounced, 8),
    enabled: debounced.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const go = (h?: SearchHit) => {
    setOpen(false);
    if (h) navigate(pathFor(h)); else if (term.trim()) navigate(`/schools?search=${encodeURIComponent(term.trim())}`);
    setTerm('');
    onNavigate?.();
  };

  return (
    <div ref={box} className={`relative ${className}`} role="combobox" aria-expanded={open && hits.length > 0} aria-haspopup="listbox" aria-owns="global-search-results">
      <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-navy-300 pointer-events-none" />
      <input
        type="search"
        value={term}
        autoFocus={autoFocus}
        onChange={(e) => { setTerm(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
          else if (e.key === 'Enter') { e.preventDefault(); go(hits[active]); }
          else if (e.key === 'Escape') setOpen(false);
        }}
        placeholder="Search schools, districts, counties"
        aria-label="Search schools, districts, and counties"
        aria-autocomplete="list"
        aria-controls="global-search-results"
        className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-navy-800/80 border border-navy-700 text-sm text-white placeholder-navy-300 focus:outline-none focus:ring-2 focus:ring-gold-400/60 focus:bg-navy-800"
      />
      {open && hits.length > 0 && (
        <ul id="global-search-results" role="listbox" className="absolute z-50 mt-1 left-0 right-0 sm:w-96 bg-white border border-stone-200 rounded-lg shadow-xl divide-y divide-stone-100 overflow-hidden">
          {hits.map((h, i) => (
            <li key={`${h.kind}-${h.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(h)}
                onMouseEnter={() => setActive(i)}
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-3 ${i === active ? 'bg-stone-50' : ''}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-stone-900 truncate">{h.name}</span>
                  <span className="block text-xs text-stone-500 truncate">{h.detail}</span>
                </span>
                <span className="text-[10px] uppercase tracking-wide text-stone-400 flex-shrink-0">{KIND_LABEL[h.kind]}</span>
              </button>
            </li>
          ))}
          <li className="px-3 py-2 text-xs text-stone-400">Enter opens the highlighted result; keep typing to narrow.</li>
        </ul>
      )}
    </div>
  );
}
