import { useEffect, useState } from 'react';
import { useT } from '../i18n';

/**
 * Shown when the browser is offline or the service worker answered a request
 * from its cache, so people know the numbers may be stale.
 */
export default function OfflineBanner() {
  const t = useT();
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const on = () => { setOffline(false); setStale(false); }; const off = () => setOffline(true);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'served-from-cache') setStale(true); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); navigator.serviceWorker?.removeEventListener('message', onMsg); };
  }, []);
  if (!offline && !stale) return null;
  return (
    <div role="status" className="bg-gold-100 dark:bg-gold-900/50 text-gold-900 dark:text-gold-100 text-sm text-center px-4 py-2 print:hidden">
      {offline ? t('offline.offline') : t('offline.stale')}
    </div>
  );
}
