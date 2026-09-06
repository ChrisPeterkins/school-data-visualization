import { afterEach, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup } from '@testing-library/react';

// Extend the running vitest's expect (the workspace has more than one vitest copy,
// so the jest-dom/vitest entry point can bind to the wrong one).
expect.extend(matchers);

afterEach(() => { cleanup(); localStorage.clear(); });
// Recharts and Leaflet measure their containers; jsdom has no layout.
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver = RO;
