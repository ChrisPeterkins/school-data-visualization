import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAvailableYears, formatYearRange } from '../hooks/useAvailableYears';
import GlobalSearch from './GlobalSearch';
import ErrorBoundary from './ErrorBoundary';
import LanguageToggle from './LanguageToggle';
import { useI18n } from '../i18n';
import {
  BuildingLibraryIcon,
  AcademicCapIcon,
  BuildingOffice2Icon,
  GlobeAmericasIcon,
  ArrowsRightLeftIcon,
  ChartBarIcon,
  TrophyIcon,
  MapIcon,
  MapPinIcon,
  Bars3Icon,
  XMarkIcon,
} from '@heroicons/react/24/outline';

const mainNav = [
  { path: '/schools', key: 'nav.schools', icon: AcademicCapIcon },
  { path: '/districts', key: 'nav.districts', icon: BuildingOffice2Icon },
  { path: '/counties', key: 'nav.counties', icon: MapPinIcon },
  { path: '/state', key: 'nav.state', icon: GlobeAmericasIcon },
  { path: '/map', key: 'nav.map', icon: MapIcon },
  { path: '/compare', key: 'nav.compare', icon: ArrowsRightLeftIcon },
  { path: '/trends', key: 'nav.trends', icon: ChartBarIcon },
  { path: '/rankings', key: 'nav.rankings', icon: TrophyIcon },
];

const formatAsOf = (iso: string | null | undefined, lang: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(lang === 'es' ? 'es-US' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
};

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const availableYears = useAvailableYears();
  const yearRange = formatYearRange(availableYears);
  const { t, lang } = useI18n();
  const asOf = formatAsOf(availableYears.lastImportAt, lang);

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navbar */}
      <nav className="bg-navy-900 border-b border-navy-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gold-500/90 group-hover:bg-gold-400 transition-colors">
                <BuildingLibraryIcon className="w-5 h-5 text-navy-900" />
              </div>
              <div>
                <span className="font-bold text-lg text-white tracking-tight">PA School Data</span>
              </div>
            </Link>

            {/* Desktop search */}
            <div className="hidden lg:block flex-1 max-w-xs mx-6">
              <GlobalSearch />
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {mainNav.map(({ path, key, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive(path)
                      ? 'bg-navy-700/80 text-gold-400'
                      : 'text-navy-200 hover:bg-navy-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t(key)}
                </Link>
              ))}
              <div className="ml-2 pl-2 border-l border-navy-700/60">
                <LanguageToggle />
              </div>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? t('nav.closeMenu') : t('nav.openMenu')}
              aria-expanded={mobileOpen}
              className="md:hidden p-2 rounded-lg text-navy-300 hover:text-white hover:bg-navy-800 transition-colors"
            >
              {mobileOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-t border-navy-700/50"
            >
              <div className="px-4 py-3 space-y-1">
                <div className="pb-2">
                  <GlobalSearch onNavigate={() => setMobileOpen(false)} />
                </div>
                {mainNav.map(({ path, key, icon: Icon }) => (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive(path)
                        ? 'bg-navy-700 text-gold-400'
                        : 'text-navy-300 hover:bg-navy-800 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(key)}
                  </Link>
                ))}
                <div className="px-3 pt-2 flex items-center justify-between text-xs text-navy-400">
                  <span>{t('nav.language')}</span>
                  <LanguageToggle />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* Page Content */}
      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <ErrorBoundary resetKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-navy-900 border-t border-navy-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BuildingLibraryIcon className="w-5 h-5 text-gold-500" />
              <span className="text-sm text-navy-300">{t('footer.brand')}</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs text-navy-500 text-center sm:text-right">
              <p>
                {t('footer.source')}
                {yearRange ? ` ${t('footer.results', { range: yearRange })}` : ''}
                {asOf ? ` ${t('footer.asOf', { date: asOf })}` : ''}
              </p>
              <Link to="/about" className="text-navy-300 hover:text-white transition-colors">{t('nav.about')}</Link>
              <a href="/paschools/api/docs/" className="text-navy-500 hover:text-navy-300 transition-colors">API</a>
              {/* Admin tools (import, verify, database, upload) sit behind HTTP basic auth in nginx. */}
              <Link to="/import" className="text-navy-500 hover:text-navy-300 transition-colors">{t('nav.admin')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
