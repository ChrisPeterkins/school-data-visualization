import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';

// Every page but Home loads on demand, so the first visit ships neither the
// chart library nor the map; each route is its own chunk.
const SchoolsPage = lazy(() => import('./pages/SchoolsPage'));
const SchoolDetailPage = lazy(() => import('./pages/SchoolDetailPage'));
const DistrictsPage = lazy(() => import('./pages/DistrictsPage'));
const DistrictDetailPage = lazy(() => import('./pages/DistrictDetailPage'));
const StatePage = lazy(() => import('./pages/StatePage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
const TrendsPage = lazy(() => import('./pages/TrendsPage'));
const RankingsPage = lazy(() => import('./pages/RankingsPage'));
const ImportProgressPage = lazy(() => import('./pages/ImportProgressPage'));
const VerifyPage = lazy(() => import('./pages/VerifyPage'));
const DatabasePage = lazy(() => import('./pages/DatabasePage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));

function PageFallback() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center" aria-busy="true">
      <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="schools" element={<Suspense fallback={<PageFallback />}><SchoolsPage /></Suspense>} />
        <Route path="schools/:id" element={<Suspense fallback={<PageFallback />}><SchoolDetailPage /></Suspense>} />
        <Route path="districts" element={<Suspense fallback={<PageFallback />}><DistrictsPage /></Suspense>} />
        <Route path="districts/:id" element={<Suspense fallback={<PageFallback />}><DistrictDetailPage /></Suspense>} />
        <Route path="state" element={<Suspense fallback={<PageFallback />}><StatePage /></Suspense>} />
        <Route path="compare" element={<Suspense fallback={<PageFallback />}><ComparePage /></Suspense>} />
        <Route path="trends" element={<Suspense fallback={<PageFallback />}><TrendsPage /></Suspense>} />
        <Route path="rankings" element={<Suspense fallback={<PageFallback />}><RankingsPage /></Suspense>} />
        <Route path="import" element={<Suspense fallback={<PageFallback />}><ImportProgressPage /></Suspense>} />
        <Route path="verify" element={<Suspense fallback={<PageFallback />}><VerifyPage /></Suspense>} />
        <Route path="database" element={<Suspense fallback={<PageFallback />}><DatabasePage /></Suspense>} />
        <Route path="upload" element={<Suspense fallback={<PageFallback />}><UploadPage /></Suspense>} />
      </Route>
    </Routes>
  );
}

export default App;
