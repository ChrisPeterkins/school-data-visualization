import type { ReactNode } from 'react';

interface AccessibleChartProps {
  /** One sentence naming the chart, e.g. "Mathematics proficient or above, 2015 to 2025". */
  label: string;
  /** Rows behind the chart; rendered as a visually hidden table for screen readers. */
  rows: Array<Record<string, unknown>>;
  columns?: Array<{ key: string; label: string }>;
  children: ReactNode;
}

/**
 * Wraps a chart so assistive technology gets its data: the SVG is hidden from
 * the accessibility tree and a screen-reader-only table carries the numbers.
 */
export default function AccessibleChart({ label, rows, columns, children }: AccessibleChartProps) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  return (
    <figure aria-label={label}>
      <div aria-hidden="true">{children}</div>
      {rows.length > 0 && (
        // A table ignores a 1px width, so the clipping wrapper has to be a div
        // or the hidden table would widen the page on phones.
        <div className="sr-only">
          <table>
            <caption>{label}</caption>
            <thead><tr>{cols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{cols.map((c) => <td key={c.key}>{r[c.key] == null ? '' : String(r[c.key])}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
