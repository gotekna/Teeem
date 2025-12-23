/**
 * Vitest Setup for Gantt Engine Tests
 *
 * This file runs before all tests to set up the test environment.
 */

import { vi, beforeEach } from 'vitest';

// Mock localStorage for persistence tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// Mock requestAnimationFrame for render tests
global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
  return setTimeout(() => callback(performance.now()), 16) as unknown as number;
});

global.cancelAnimationFrame = vi.fn((id: number) => {
  clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
});

// Mock performance.now if not available
if (!global.performance) {
  global.performance = {
    now: vi.fn(() => Date.now()),
  } as unknown as Performance;
}

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

// Export for use in tests
export { localStorageMock };
