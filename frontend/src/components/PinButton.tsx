import { BookmarkIcon } from '@heroicons/react/24/outline';
import { BookmarkIcon as BookmarkSolid } from '@heroicons/react/24/solid';
import { usePins, type Pin } from '../lib/watchlist';
import { useT } from '../i18n';

/** Add or remove a school or district from the browser's watchlist. */
export default function PinButton({ pin, className = '' }: { pin: Pin; className?: string }) {
  const { isPinned, toggle } = usePins();
  const t = useT();
  const on = isPinned(pin.kind, pin.id);
  return (
    <button
      type="button"
      onClick={() => toggle(pin)}
      aria-pressed={on}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${on ? 'border-gold-400 bg-gold-50 text-gold-800 hover:bg-gold-100' : 'border-stone-200 bg-white text-stone-600 hover:border-navy-300 hover:text-navy-700'} ${className}`}
      title={t(on ? 'pin.remove' : 'pin.add')}
    >
      {on ? <BookmarkSolid className="w-4 h-4" /> : <BookmarkIcon className="w-4 h-4" />}
      <span>{t(on ? 'pin.pinned' : 'pin.pin')}</span>
    </button>
  );
}
