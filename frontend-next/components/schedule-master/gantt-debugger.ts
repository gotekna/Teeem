// Gantt debugger stub - to be implemented
export const bugHunter = {
  debug: (...args: unknown[]) => console.log('[BugHunter]', ...args),
  log: (...args: unknown[]) => console.log('[BugHunter]', ...args),
  warn: (...args: unknown[]) => console.warn('[BugHunter]', ...args),
  error: (...args: unknown[]) => console.error('[BugHunter]', ...args),
  runTests: () => Promise.resolve({ passed: 0, failed: 0, tests: [] }),
};
