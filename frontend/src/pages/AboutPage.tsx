import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useAvailableYears, formatYearRange } from '../hooks/useAvailableYears';
import { useI18n } from '../i18n';
import AboutPageEs from './AboutPageEs';

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="card-surface p-5 sm:p-7 space-y-3">
    <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
    <div className="text-sm text-stone-600 leading-relaxed space-y-3">{children}</div>
  </section>
);

/** Where the numbers come from and how the site computes them. */
export default function AboutPage() {
  const years = useAvailableYears();
  const range = formatYearRange(years);
  const { lang } = useI18n();
  useDocumentTitle(lang === 'es' ? 'Acerca de los datos' : 'About the data', 'Sources, methods, and caveats behind the Pennsylvania School Data Explorer.');
  if (lang === 'es') return <AboutPageEs range={range} />;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900 tracking-tight">About the data</h1>
        <p className="mt-1 text-sm text-stone-500">Every number on this site traces back to a public file. This page explains which files, what was done to them, and where to be careful.</p>
      </div>

      <nav className="text-sm text-navy-700 flex flex-wrap gap-x-4 gap-y-1" aria-label="On this page">
        {[['sources', 'Sources'], ['measures', 'What the measures mean'], ['methods', 'How figures are computed'], ['caveats', 'Caveats by year'], ['updates', 'Updates'], ['privacy', 'Privacy']].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="hover:underline">{label}</a>
        ))}
      </nav>

      <Section id="sources" title="Sources">
        <p>
          <strong>Assessment results</strong> come from the Pennsylvania Department of Education's public spreadsheets for the
          PSSA (grades 3 to 8) and Keystone Exams (grade 11), published each year at school, district, and state level on the{' '}
          <a className="text-navy-700 underline" href="https://www.pa.gov/agencies/education/data-and-reporting/assessment-reporting" target="_blank" rel="noreferrer">PDE Assessment Reporting page</a>.
          Currently loaded: {range || '2015-2025'} for PSSA and Keystone, plus 2013 and 2014 Keystone results recovered from PDE's archived site.
        </p>
        <p>
          <strong>Growth</strong> comes from PDE's PVAAS value-added files (school and district, by subject and grade, and by student group).
          <strong> School details</strong> such as addresses, coordinates, enrollment, grade span, and level come from the NCES Common Core of Data via the Urban Institute's Education Data API.
          <strong> District boundaries</strong> on the map are the U.S. Census Bureau's 2023 cartographic school district file.
        </p>
      </Section>

      <Section id="measures" title="What the measures mean">
        <p><strong>Proficient or above</strong> is the share of tested students scoring Proficient or Advanced. PDE also reports Advanced, Proficient, Basic, and Below Basic separately; those appear in the level breakdowns.</p>
        <p>
          <strong>Growth</strong> is the PVAAS growth index, a standardized measure of whether a school's students grew more or less than the state expects given their prior scores.
          PDE's bands: roughly +2 or more is well above the standard, +1 to +2 above, -1 to +1 meets, -1 to -2 below, -2 or less well below. Growth is about progress, not level: a school can be low on proficiency and high on growth.
        </p>
        <p><strong>Students tested</strong> is PDE's "number scored" for the row. Groups with fewer than 11 students are suppressed by PDE and appear as N/A.</p>
      </Section>

      <Section id="methods" title="How figures are computed">
        <p>
          <strong>Weighting.</strong> Any figure that combines schools, districts, or grades (trends, county pages, rankings with multiple subjects, gaps) is weighted by students tested.
          The result is the share of students, not an average of school percentages, so a 1,200-student school counts twelve times a 100-student school.
        </p>
        <p>
          <strong>All-grades totals.</strong> PDE's files include an all-grades "Total" row for each school, district, and the state. Those rows are used wherever a single figure per entity is shown and are labelled "All grades".
          Charts by grade use the grade rows.
        </p>
        <p>
          <strong>Rankings and percentiles</strong> use the all-grades total for the chosen subject (or the tested-weighted combination of subjects), require a minimum number of students tested (40 by default for rankings, 20 for percentiles), and compare like with like: percentiles are shown statewide, within the county, and among schools of the same level.
        </p>
        <p>
          <strong>Gaps</strong> are percentage-point differences between a student group and All Students in the same school, district, county, or the state, for the same subject and year.
        </p>
        <p>
          <strong>Derived rows.</strong> PDE's 2016 Keystone district file lists only about 300 of 500 districts, and the archived 2013 and 2014 files have no district level at all. For those years, district figures are rebuilt from the district's schools, weighted by students tested. They carry the source "derived-from-schools" in the database.
        </p>
      </Section>

      <Section id="caveats" title="Caveats by year">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>2020:</strong> no PSSA or Keystone exams were given (COVID-19). Charts leave the year blank rather than drawing a line across it.</li>
          <li><strong>2021:</strong> testing resumed with reduced participation; about a fifth of school-level rows are suppressed and many districts tested in fall rather than spring. Treat 2021 comparisons cautiously.</li>
          <li><strong>2025:</strong> PDE raised the PSSA performance standards. The drop from 2024 partly reflects the new bar rather than a change in learning. Statewide ELA (all grades) went from 53% to 48.5% and Math from 40% to 42%. PDE also published no 2025 Science results, so Science series end at 2024.</li>
          <li><strong>2013 and 2014:</strong> Keystone only, school and state level, from PDE's archived site. PSSA files for 2012 to 2014 were not preserved, so PSSA begins in 2015.</li>
          <li><strong>Statewide student groups before 2022:</strong> PDE's statewide files reported only All Students and Historically Underperforming, so statewide gap trends for other groups begin in 2022. School and district gaps go back to 2015.</li>
          <li><strong>Closed schools:</strong> schools with no listing in the 2023 NCES directory and no results in the latest year are marked closed and hidden from search unless you ask for them. Their history stays.</li>
        </ul>
      </Section>

      <Section id="updates" title="Updates">
        <p>
          PDE releases each year's results in the fall. A weekly check watches the PDE page, downloads any new files, imports them, and refreshes the site; the admin page shows the last check.
          PDE has said the 2026 results are on hold until later in fall 2026.
        </p>
        <p>
          The source code, import scripts, and a full description of each file's layout are on{' '}
          <a className="text-navy-700 underline" href="https://github.com/ChrisPeterkins/school-data-visualization" target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </Section>

      <Section id="privacy" title="Privacy">
        <p>The site shows only aggregate figures PDE has already published; it holds no individual student data. It sets no tracking cookies. Map tiles load from OpenStreetMap.</p>
      </Section>

      <p className="text-sm text-stone-500">
        Questions about a specific number? Start from the <Link to="/state" className="text-navy-700 underline">statewide view</Link>, then the school or district page, where each table shows the year, group, and students tested behind the figure.
      </p>
    </div>
  );
}
