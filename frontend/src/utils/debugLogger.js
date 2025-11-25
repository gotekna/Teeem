/**
 * Debug Logger Utility
 *
 * Provides conditional logging based on environment flags.
 * Reduces console noise in development while allowing targeted debugging.
 *
 * Usage:
 *   import { progressiveLoadLog, progressiveSyncLog } from '@/utils/debugLogger'
 *
 *   progressiveLoadLog('Loading records...', { count: 500 })
 *   progressiveSyncLog('State updated', { recordsCount: 1000 })
 *
 * Environment Variables:
 *   VITE_DEBUG_PROGRESSIVE_LOADING=true   - Enable progressive loading logs
 *   VITE_DEBUG_PROGRESS_SYNC=true         - Enable progress sync logs
 *   VITE_DEBUG_ALL=true                   - Enable all debug logs
 */

// Check environment flags
const isDebugAll = import.meta.env.VITE_DEBUG_ALL === 'true'
const isDebugProgressiveLoading = import.meta.env.VITE_DEBUG_PROGRESSIVE_LOADING === 'true' || isDebugAll
const isDebugProgressSync = import.meta.env.VITE_DEBUG_PROGRESS_SYNC === 'true' || isDebugAll

/**
 * Log progressive loading events (views, records, background loads)
 * Enable with: VITE_DEBUG_PROGRESSIVE_LOADING=true
 */
export const progressiveLoadLog = (...args) => {
  if (isDebugProgressiveLoading) {
    console.log('[Progressive Loading]', ...args)
  }
}

/**
 * Log progress synchronization events (state updates, rendering)
 * Enable with: VITE_DEBUG_PROGRESS_SYNC=true
 */
export const progressiveSyncLog = (...args) => {
  if (isDebugProgressSync) {
    console.log('[PROGRESS SYNC]', ...args)
  }
}

/**
 * Log preload events (sessionStorage cache hits/misses)
 * Enable with: VITE_DEBUG_PROGRESSIVE_LOADING=true
 */
export const preloadLog = (...args) => {
  if (isDebugProgressiveLoading) {
    console.log('[Preload]', ...args)
  }
}

/**
 * Log infinite scroll events
 * Enable with: VITE_DEBUG_PROGRESSIVE_LOADING=true
 */
export const infiniteScrollLog = (...args) => {
  if (isDebugProgressiveLoading) {
    console.log('[Infinite Scroll]', ...args)
  }
}

/**
 * Log loading progress updates
 * Enable with: VITE_DEBUG_PROGRESS_SYNC=true
 */
export const loadingProgressLog = (...args) => {
  if (isDebugProgressSync) {
    console.log('[Loading Progress]', ...args)
  }
}

/**
 * Always log errors (not affected by debug flags)
 */
export const progressiveLoadError = (...args) => {
  console.error('[Progressive Loading]', ...args)
}

/**
 * Helper to check if debug mode is enabled
 */
export const isDebugMode = {
  progressiveLoading: isDebugProgressiveLoading,
  progressSync: isDebugProgressSync,
  all: isDebugAll
}

// Log debug status on first import (only in development)
if (import.meta.env.DEV) {
  const activeFlags = []
  if (isDebugProgressiveLoading) activeFlags.push('PROGRESSIVE_LOADING')
  if (isDebugProgressSync) activeFlags.push('PROGRESS_SYNC')
  if (isDebugAll) activeFlags.push('ALL')

  if (activeFlags.length > 0) {
    console.log(
      '%c[Debug Logger] Active debug flags: ' + activeFlags.join(', '),
      'color: #10b981; font-weight: bold'
    )
  }
}

export default {
  progressiveLoadLog,
  progressiveSyncLog,
  preloadLog,
  infiniteScrollLog,
  loadingProgressLog,
  progressiveLoadError,
  isDebugMode
}
