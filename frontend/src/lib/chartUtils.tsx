import { ReferenceLine, ReferenceArea } from 'recharts';

/** PDE raised the PSSA performance standards starting with the 2025 results. */
export const STANDARDS_CHANGE_YEAR = 2025;
/** No assessments were given in 2020. */
export const COVID_GAP_YEAR = 2020;

export const CHART_COLORS = {
  navy: '#2d4a6f',
  navyDark: '#243b5c',
  navyMid: '#4a6d8c',
  navyLight: '#a8c3d8',
  teal: '#27ab83',
  gold: '#d4aa3c',
  brick: '#c53030',
  stone: '#d6d3d1',
};

export const tooltipStyle = {
  backgroundColor: '#fff',
  border: '1px solid #e7e5e4',
  borderRadius: '0.5rem',
  fontSize: '13px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
};

/**
 * Insert null-valued rows for missing years so a line chart shows a visible
 * gap (2020) instead of silently joining 2019 to 2021.
 */
export function fillYearGaps<T extends { year: number }>(rows: T[]): (T | { year: number })[] {
  if (rows.length < 2) return rows;
  const sorted = [...rows].sort((a, b) => a.year - b.year);
  const out: (T | { year: number })[] = [];
  for (let y = sorted[0].year; y <= sorted[sorted.length - 1].year; y++) {
    const hit = sorted.find((r) => r.year === y);
    out.push(hit ?? { year: y });
  }
  return out;
}

/**
 * Reference line marking the 2025 standards change. Must be spread directly
 * into a Recharts chart's children (Recharts inspects child element types), so
 * this returns an element rather than wrapping one in a component.
 */
export function standardsChangeLine(years: number[], label = 'New standards') {
  if (!years.includes(STANDARDS_CHANGE_YEAR)) return null;
  return (
    <ReferenceLine
      key="standards-change"
      x={STANDARDS_CHANGE_YEAR}
      stroke={CHART_COLORS.gold}
      strokeDasharray="4 3"
      label={{ value: label, position: 'insideTopRight', fill: '#997321', fontSize: 11 }}
    />
  );
}

/**
 * Shaded band over 2020, when PDE cancelled all PSSA and Keystone testing, so a
 * gap between 2019 and 2021 reads as "no data" rather than a missing year.
 * Requires the 2020 placeholder row from fillYearGaps to be in the data.
 */
export function covidGapArea(years: number[], label = 'No testing in 2020 (COVID-19)') {
  if (!years.includes(2019) || !years.includes(2021) || years.includes(COVID_GAP_YEAR)) return null;
  // Category axes place each year at a point, so a same-year area has no
  // width; span the neighbours instead so the band is visible.
  return (
    <ReferenceArea
      key="covid-gap"
      x1={2019}
      x2={2021}
      fill="#a8a29e"
      fillOpacity={0.08}
      stroke="#a8a29e"
      strokeDasharray="3 3"
      strokeOpacity={0.6}
      label={{ value: label, position: 'insideTop', fill: '#78716c', fontSize: 10 }}
    />
  );
}

/** Human-readable label for a PSSA grade value where 0 means the all-grades total. */
export const gradeLabel = (grade: number | null | undefined): string =>
  grade == null || grade === 0 ? 'All grades' : `Grade ${grade}`;

/** PVAAS growth index bands used in PDE reporting. */
export function growthBand(growth: number | null | undefined): { label: string; className: string } {
  if (growth == null || Number.isNaN(growth)) return { label: '—', className: 'text-stone-400' };
  if (growth >= 2) return { label: 'Well above', className: 'text-navy-800 font-semibold' };
  if (growth >= 1) return { label: 'Above', className: 'text-navy-600 font-semibold' };
  if (growth > -1) return { label: 'Meets', className: 'text-stone-700' };
  if (growth > -2) return { label: 'Below', className: 'text-gold-700 font-semibold' };
  return { label: 'Well below', className: 'text-brick-600 font-semibold' };
}

export const formatPct = (v: number | null | undefined, digits = 1) =>
  v == null || Number.isNaN(v) ? 'N/A' : `${v.toFixed(digits)}%`;
