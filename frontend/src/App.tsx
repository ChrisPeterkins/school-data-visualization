import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import SchoolsPage from './pages/SchoolsPage';
import SchoolDetailPage from './pages/SchoolDetailPage';
import DistrictsPage from './pages/DistrictsPage';
import StatePage from './pages/StatePage';
import ComparePage from './pages/ComparePage';
import TrendsPage from './pages/TrendsPage';
import ImportProgressPage from './pages/ImportProgressPage';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="schools" element={<SchoolsPage />} />
        <Route path="schools/:id" element={<SchoolDetailPage />} />
        <Route path="districts" element={<DistrictsPage />} />
        <Route path="state" element={<StatePage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="trends" element={<TrendsPage />} />
        <Route path="import" element={<ImportProgressPage />} />
      </Route>
    </Routes>
  );
}

export default App;