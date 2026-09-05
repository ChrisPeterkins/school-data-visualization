import { Link } from 'react-router-dom';
import { STANDARDS_CHANGE_YEAR } from '../lib/chartUtils';

interface DataNotesProps {
  subject?: string;
  exam?: 'pssa' | 'keystone';
  /** Years present in the data being charted. */
  years: number[];
  /** Latest year loaded in the database, to detect a subject that stopped early. */
  latestAvailable?: number | null;
}

/**
 * Short caveats that keep a chart from being misread: the 2025 standards
 * change, the 2020 testing gap, and Science results that were not published.
 */
export default function DataNotes({ subject, exam = 'pssa', years, latestAvailable }: DataNotesProps) {
  const notes: string[] = [];
  const last = years.length ? Math.max(...years) : null;

  if (years.includes(STANDARDS_CHANGE_YEAR) && exam === 'pssa') {
    notes.push(`PDE raised the PSSA performance standards for ${STANDARDS_CHANGE_YEAR}, so the drop from 2024 partly reflects the new bar rather than a change in learning.`);
  }
  if (years.includes(2019) && years.includes(2021)) {
    notes.push('No assessments were given in 2020.');
  }
  if (subject === 'Science' && latestAvailable != null && last != null && last < latestAvailable) {
    notes.push(`PDE did not publish Science results for ${latestAvailable}; the Science series ends at ${last}.`);
  }

  if (notes.length === 0) return null;
  return (
    <ul className="text-xs text-stone-500 space-y-1 border-l-2 border-gold-300 pl-3">
      {notes.map((n) => <li key={n}>{n}</li>)}
      <li><Link to="/about#caveats" className="text-navy-600 hover:underline">About the data</Link></li>
    </ul>
  );
}
