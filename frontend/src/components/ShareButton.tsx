import { useState } from 'react';
import { ShareIcon, CheckIcon } from '@heroicons/react/24/outline';
import { sharePage } from '../lib/chartExport';
import { useT } from '../i18n';

/** Share the page with the Web Share API, or copy the link on desktops. */
export default function ShareButton({ title, text }: { title: string; text?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const t = useT();
  return (
    <button
      type="button"
      onClick={async () => { const r = await sharePage(title, text); setState(r === 'copied' ? 'copied' : r === 'failed' ? 'failed' : 'idle'); if (r !== 'shared') setTimeout(() => setState('idle'), 2000); }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-stone-200 bg-white text-sm font-medium text-stone-600 hover:border-navy-300 hover:text-navy-700 transition-colors print:hidden"
    >
      {state === 'copied' ? <CheckIcon className="w-4 h-4 text-teal-700" /> : <ShareIcon className="w-4 h-4" />}
      <span>{state === 'copied' ? t('share.copied') : state === 'failed' ? t('share.failed') : t('share.share')}</span>
    </button>
  );
}
