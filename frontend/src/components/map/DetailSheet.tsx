import { useEffect, useState } from 'react';
import { ChevronUpIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface DetailSheetProps {
  /** Changes when a different item is selected; the sheet re-peeks. */
  itemKey: string | number;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Short figure shown while collapsed on phones, e.g. "Math 57.7% · growth 1.3". */
  peek?: string;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Detail panel for the map. On phones it is a bottom sheet over the map that
 * slides up as a peek strip and expands on tap; from `sm` it is the floating
 * card at the top right. Both live inside the map's positioned container.
 */
export default function DetailSheet({ itemKey, eyebrow, title, subtitle, peek, onClose, children }: DetailSheetProps) {
  const [expanded, setExpanded] = useState(false);
  const [shown, setShown] = useState(false);

  // New selection: start collapsed and replay the slide-up so the change is visible.
  useEffect(() => {
    setExpanded(false);
    setShown(false);
    const t = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(t);
  }, [itemKey]);

  return (
    <div
      role="dialog"
      aria-label={title}
      className={`absolute z-[1000] left-0 right-0 bottom-0 sm:left-auto sm:bottom-auto sm:top-14 sm:right-3 sm:w-80
        bg-white sm:rounded-xl rounded-t-2xl shadow-[0_-6px_24px_rgba(0,0,0,0.18)] sm:shadow-lg border-t sm:border border-stone-200
        transition-transform duration-300 ease-out ${shown ? 'translate-y-0' : 'translate-y-full sm:translate-y-0'}`}
    >
      {/* Header doubles as the expand/collapse handle on phones. */}
      <div className="flex items-start gap-2 p-3 sm:p-4 sm:pb-0">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="flex-1 min-w-0 text-left sm:cursor-default"
        >
          <div className="sm:hidden mx-auto mb-2 h-1 w-10 rounded-full bg-stone-300" aria-hidden />
          {eyebrow && <div className="text-[11px] uppercase tracking-wide text-stone-500">{eyebrow}</div>}
          <div className="text-sm font-semibold text-stone-900 leading-snug">{title}</div>
          {subtitle && <div className="text-xs text-stone-500 truncate">{subtitle}</div>}
          {peek && !expanded && <div className="sm:hidden mt-1 text-sm text-navy-800 font-medium">{peek}</div>}
        </button>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-label={expanded ? 'Show less' : 'Show more'}
            className="sm:hidden p-1 text-stone-500 hover:text-stone-600"
          >
            <ChevronUpIcon className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-stone-500 hover:text-stone-600">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
      <div className={`px-3 pb-3 sm:px-4 sm:pb-4 sm:block ${expanded ? 'block max-h-[55vh] overflow-y-auto' : 'hidden'}`}>
        {children}
      </div>
    </div>
  );
}
