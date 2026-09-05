import { Outlet, Link, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAvailableYears, formatYearRange } from '../hooks/useAvailableYears';
import GlobalSearch from './GlobalSearch';
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
  { path: '/schools', label: 'Schools', icon: AcademicCapIcon },
  { path: '/districts', label: 'Districts', icon: BuildingOffice2Icon },
  { path: '/counties', label: 'Counties', icon: MapPinIcon },
  { path: '/state', label: 'State', icon: GlobeAmericasIcon },
  { path: '/map', label: 'Map', icon: MapIcon },
  { path: '/compare', label: 'Compare', icon: ArrowsRightLeftIcon },
  { path: '/trends', label: 'Trends', icon: ChartBarIcon },
  { path: '/rankings', label: 'Rankings', icon: TrophyIcon },
];

export default function Layout() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const availableYears = useAvailableYears();
  const yearRange = formatYearRange(availableYears);

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
              {mainNav.map(({ path, label, icon: Icon }) => (
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
                  {label}
                </Link>
              ))}
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
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
                {mainNav.map(({ path, label, icon: Icon }) => (
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
                    {label}
                  </Link>
                ))}
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
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="bg-navy-900 border-t border-navy-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BuildingLibraryIcon className="w-5 h-5 text-gold-500" />
              <span className="text-sm text-navy-300">PA School Data Explorer</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-xs text-navy-500 text-center sm:text-right">
              <p>
                Data sourced from Pennsylvania Department of Education.
                {yearRange ? ` PSSA & Keystone results ${yearRange}.` : ''}
              </p>
              <Link to="/about" className="text-navy-300 hover:text-white transition-colors">About the data</Link>
              {/* Admin tools (import, verify, database, upload) sit behind HTTP basic auth in nginx. */}
              <Link to="/import" className="text-navy-500 hover:text-navy-300 transition-colors">Admin</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
