"use client";

import { useState, useCallback, useRef } from "react";
import { useAbortController, isAbortError } from "./useAbortController";

/**
 * State for async operation
 */
interface AsyncState<T> {
  /** The data returned from the operation (null until first success) */
  data: T | null;
  /** Whether an operation is currently in progress */
  loading: boolean;
  /** Error message if the last operation failed */
  error: string | null;
  /** Whether at least one operation has completed successfully */
  hasLoaded: boolean;
}

/**
 * Options for useAsyncOperation
 */
interface UseAsyncOperationOptions<T> {
  /** Initial data value */
  initialData?: T | null;
  /** Called when operation succeeds */
  onSuccess?: (data: T) => void;
  /** Called when operation fails */
  onError?: (error: Error) => void;
}

/**
 * Return type for useAsyncOperation hook
 */
interface UseAsyncOperationReturn<T> extends AsyncState<T> {
  /**
   * Execute an async operation with automatic loading/error state management
   * @param operation - Async function that returns data
   * @returns Promise that resolves to the data or undefined if aborted/failed
   */
  execute: (operation: (signal: AbortSignal) => Promise<T>) => Promise<T | undefined>;

  /**
   * Reset state to initial values
   */
  reset: () => void;

  /**
   * Set data directly without executing an operation
   */
  setData: (data: T | null) => void;

  /**
   * Set error directly
   */
  setError: (error: string | null) => void;

  /**
   * Abort the current operation
   */
  abort: () => void;
}

/**
 * Hook for managing async operations with loading and error states
 *
 * SSoT for loading/error state patterns across the app.
 * Replaces 11+ hooks that manually manage loading, error, and data state.
 *
 * Features:
 * - Automatic loading state management
 * - Error capture and display
 * - AbortController integration (auto-cancels on new request or unmount)
 * - Optional success/error callbacks
 * - TypeScript generic for type-safe data
 *
 * @example
 * ```tsx
 * function ContactList() {
 *   const { data: contacts, loading, error, execute } = useAsyncOperation<Contact[]>();
 *
 *   useEffect(() => {
 *     execute((signal) => api.get('/contacts', { signal }));
 *   }, [execute]);
 *
 *   if (loading) return <Spinner />;
 *   if (error) return <div>Error: {error}</div>;
 *   return <ul>{contacts?.map(c => <li key={c.id}>{c.name}</li>)}</ul>;
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With callbacks for side effects
 * const { execute, loading } = useAsyncOperation<void>({
 *   onSuccess: () => toast.success("Saved!"),
 *   onError: (err) => toast.error(err.message),
 * });
 *
 * const handleSave = () => execute((signal) =>
 *   api.post('/save', data, { signal })
 * );
 * ```
 */
export function useAsyncOperation<T>(
  options: UseAsyncOperationOptions<T> = {}
): UseAsyncOperationReturn<T> {
  const { initialData = null, onSuccess, onError } = options;

  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const { getController, abort } = useAbortController();

  // Track if component is mounted to avoid state updates after unmount
  const isMountedRef = useRef(true);

  // Set mounted flag on unmount
  // Note: This is handled by useAbortController's cleanup, but we also track for state updates
  useState(() => {
    return () => {
      isMountedRef.current = false;
    };
  });

  const execute = useCallback(
    async (operation: (signal: AbortSignal) => Promise<T>): Promise<T | undefined> => {
      // Get new controller (aborts any previous operation)
      const controller = getController();

      setLoading(true);
      setError(null);

      try {
        const result = await operation(controller.signal);

        // Only update state if not aborted and still mounted
        if (!controller.signal.aborted && isMountedRef.current) {
          setData(result);
          setHasLoaded(true);
          onSuccess?.(result);
        }

        return result;
      } catch (err) {
        // Ignore abort errors
        if (isAbortError(err)) {
          return undefined;
        }

        // Only update state if still mounted
        if (isMountedRef.current) {
          const errorMessage = err instanceof Error ? err.message : "Unknown error";
          setError(errorMessage);
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        }

        return undefined;
      } finally {
        // Only update loading state if not aborted and still mounted
        if (!controller.signal.aborted && isMountedRef.current) {
          setLoading(false);
        }
      }
    },
    [getController, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setData(initialData);
    setLoading(false);
    setError(null);
    setHasLoaded(false);
    abort();
  }, [initialData, abort]);

  return {
    data,
    loading,
    error,
    hasLoaded,
    execute,
    reset,
    setData,
    setError,
    abort,
  };
}

export default useAsyncOperation;
