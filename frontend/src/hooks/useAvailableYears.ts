import { useQuery } from '@tanstack/react-query';
import { performanceApi } from '../services/api';

export interface AvailableYears {
  years: number[];
  latest: number | null;
  earliest: number | null;
  counts?: {
    schools: number;
    districts: number;
    pssaRecords: number;
    keystoneRecords: number;
  };
}

const EMPTY: AvailableYears = { years: [], latest: null, earliest: null };

/**
 * Years that actually exist in the database, newest first. Pages use this to
 * build year pickers and default to the latest year, so a new PDE release only
 * needs a data import, not a frontend change.
 */
export function useAvailableYears(): AvailableYears & { isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ['available-years'],
    queryFn: performanceApi.getAvailableYears,
    staleTime: 60 * 60 * 1000,
  });
  return { ...(data ?? EMPTY), isLoading };
}

export function formatYearRange(years: AvailableYears): string {
  if (years.earliest == null || years.latest == null) return '';
  return years.earliest === years.latest ? `${years.latest}` : `${years.earliest}-${years.latest}`;
}
