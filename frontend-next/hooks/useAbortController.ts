"use client";

import { useRef, useCallback, useEffect } from "react";

/**
 * Return type for useAbortController hook
 */
interface UseAbortControllerReturn {
  /**
   * Get a new AbortController, aborting any existing one
   * Use this when starting a new async operation that should cancel previous operations
   */
  getController: () => AbortController;

  /**
   * Get the current AbortController's signal
   * Use this to pass to fetch/api calls
   */
  getSignal: () => AbortSignal | undefined;

  /**
   * Manually abort the current operation
   * Call this to cancel any in-flight requests
   */
  abort: () => void;

  /**
   * Check if the current controller is aborted
   */
  isAborted: () => boolean;
}

/**
 * Hook to manage AbortController lifecycle for async operations
 *
 * Automatically:
 * - Creates new controllers on demand
 * - Aborts previous controllers when getting a new one
 * - Cleans up on component unmount
 *
 * SSoT for AbortController management in async hooks.
 * Replaces inline AbortController patterns in useGroupCounts, useSpellCheck, etc.
 *
 * @example
 * ```tsx
 * function useMyAsyncHook() {
 *   const { getController, abort } = useAbortController();
 *
 *   const fetchData = useCallback(async () => {
 *     const controller = getController(); // Aborts any previous request
 *     try {
 *       const response = await fetch(url, { signal: controller.signal });
 *       // ...
 *     } catch (err) {
 *       if (err instanceof Error && err.name === "AbortError") {
 *         return; // Ignore abort errors
 *       }
 *       throw err;
 *     }
 *   }, [getController]);
 *
 *   // Cleanup on unmount is automatic
 *   return { fetchData, abort };
 * }
 * ```
 */
export function useAbortController(): UseAbortControllerReturn {
  const controllerRef = useRef<AbortController | null>(null);

  // Get a new controller, aborting any existing one
  const getController = useCallback(() => {
    // Abort previous controller if it exists
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    // Create and store new controller
    controllerRef.current = new AbortController();
    return controllerRef.current;
  }, []);

  // Get the current signal (if a controller exists)
  const getSignal = useCallback(() => {
    return controllerRef.current?.signal;
  }, []);

  // Manually abort the current operation
  const abort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
  }, []);

  // Check if current controller is aborted
  const isAborted = useCallback(() => {
    return controllerRef.current?.signal.aborted ?? false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, []);

  return {
    getController,
    getSignal,
    abort,
    isAborted,
  };
}

/**
 * Helper to check if an error is an AbortError
 * Use this in catch blocks to ignore expected abort errors
 */
export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export default useAbortController;
