import type { ReactNode, ChangeEvent } from 'react';

interface FilterSelectProps {
  label: string;
  value: string | number;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
  /** Let the control fill the row on small screens (default true). */
  fluid?: boolean;
}

/**
 * Labelled select used by the filter rows on the State, Trends, Rankings and
 * Compare pages. Stacks label-over-control on phones and sits inline from `sm`.
 */
export default function FilterSelect({ label, value, onChange, children, fluid = true }: FilterSelectProps) {
  return (
    <label className={`flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-2 ${fluid ? 'w-full sm:w-auto' : ''}`}>
      <span className="text-xs font-medium text-stone-500 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={onChange}
        className="w-full sm:w-auto px-3 py-2 sm:py-1.5 text-base sm:text-sm border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
      >
        {children}
      </select>
    </label>
  );
}
