import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useUrlState, parseNumber, parseString } from '../useUrlState';

const wrapper = ({ children }: { children: React.ReactNode }) => <BrowserRouter>{children}</BrowserRouter>;

describe('useUrlState', () => {
  it('reads the default when the param is absent and writes updates to the URL', () => {
    window.history.replaceState({}, '', '/rankings');
    const { result } = renderHook(() => useUrlState<string>('exam', 'pssa', parseString), { wrapper });
    expect(result.current[0]).toBe('pssa');
    act(() => result.current[1]('keystone'));
    expect(result.current[0]).toBe('keystone');
    expect(new URLSearchParams(window.location.search).get('exam')).toBe('keystone');
  });

  it('keeps other params when one changes (the Rankings exam-switch regression)', () => {
    window.history.replaceState({}, '', '/rankings?year=2024');
    const { result: exam } = renderHook(() => useUrlState<string>('exam', 'pssa', parseString), { wrapper });
    const { result: year } = renderHook(() => useUrlState<number | null>('year', null, parseNumber, (v) => (v == null ? '' : String(v))), { wrapper });
    act(() => exam.current[1]('keystone'));
    act(() => year.current[1](2025));
    const q = new URLSearchParams(window.location.search);
    expect(q.get('exam')).toBe('keystone');
    expect(q.get('year')).toBe('2025');
  });
});
