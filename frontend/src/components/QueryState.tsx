import type { ReactNode } from 'react';

interface QueryStateProps {
  isLoading?: boolean;
  error?: unknown;
  /** True when the query succeeded but returned nothing to show. */
  empty?: boolean;
  emptyMessage?: string;
  loadingMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}

/** Uniform loading, error, and empty states around a page section. */
export default function QueryState({ isLoading, error, empty, emptyMessage = 'Nothing matches this selection.', loadingMessage = 'Loading…', onRetry, children }: QueryStateProps) {
  if (isLoading) {
    return (
      <div className="card-surface p-12 text-center" aria-busy="true">
        <div className="inline-block w-8 h-8 border-2 border-navy-200 border-t-navy-600 rounded-full animate-spin" />
        <p className="mt-3 text-sm text-stone-500">{loadingMessage}</p>
      </div>
    );
  }
  if (error) {
    const message = error instanceof Error ? error.message : 'The request failed.';
    return (
      <div className="card-surface border-brick-200 bg-brick-50 p-6" role="alert">
        <p className="text-sm font-medium text-brick-800">Could not load this section</p>
        <p className="mt-1 text-xs text-brick-700">{message}</p>
        {onRetry && <button onClick={onRetry} className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-navy-700 text-white hover:bg-navy-600">Try again</button>}
      </div>
    );
  }
  if (empty) {
    return <div className="card-surface p-10 text-center text-sm text-stone-500">{emptyMessage}</div>;
  }
  return <>{children}</>;
}
