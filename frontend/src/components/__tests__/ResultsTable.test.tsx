import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { I18nProvider } from '../../i18n';
import ResultsTable from '../ResultsTable';

const rows = [
  { grade: 3, subject: 'Mathematics', numberScored: 80, percentProficientOrAbove: 55.5, growthScore: 2.4 },
  { grade: 0, subject: 'Mathematics', numberScored: 400, percentProficientOrAbove: 48.1, growthScore: null },
  { grade: 3, subject: 'English Language Arts', numberScored: 10, percentProficientOrAbove: null, growthScore: -2.5 },
];

describe('ResultsTable', () => {
  it('renders every row as both a phone card and a table row, with the all-grades total last', () => {
    render(<I18nProvider><ResultsTable results={rows} showGrade /></I18nProvider>);
    const cards = within(screen.getByTestId('results-cards')).getAllByRole('listitem');
    expect(cards).toHaveLength(3);
    expect(cards[2]).toHaveTextContent('All grades');
    const bodyRows = screen.getAllByRole('row').slice(1);
    expect(bodyRows).toHaveLength(3);
    // Grade rows sort by grade then subject, so grade 3 ELA precedes grade 3 Math.
    expect(bodyRows[1]).toHaveTextContent('55.5%');
    expect(bodyRows[1]).toHaveTextContent('2.4');
  });

  it('shows N/A for suppressed rows and hides level columns in compact mode', () => {
    render(<I18nProvider><ResultsTable results={rows} showGrade compact /></I18nProvider>);
    expect(screen.queryByText('% Advanced')).toBeNull();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });
});
