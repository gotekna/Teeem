/**
 * Cached Canvas Text Measurement Utility
 *
 * Performance optimizations:
 * - Singleton canvas context (avoids repeated DOM creation)
 * - LRU cache for text measurements (10k entries max)
 * - Single source of truth for all column width calculations
 */

// Singleton canvas context
let measureCtx: CanvasRenderingContext2D | null = null;

// LRU-style measurement cache (font|text -> width)
const measurementCache = new Map<string, number>();
const CACHE_MAX_SIZE = 10000;

/**
 * Get or create the canvas measurement context
 */
function getContext(): CanvasRenderingContext2D | null {
  if (!measureCtx) {
    const canvas = document.createElement('canvas');
    measureCtx = canvas.getContext('2d');
  }
  return measureCtx;
}

/**
 * Measure text width using cached canvas context
 * @param text - The text to measure
 * @param font - CSS font string (e.g., '14px system-ui')
 * @returns Width in pixels
 */
export function measureText(text: string, font: string): number {
  // Handle empty/null text
  if (!text) return 0;

  // Check cache first
  const cacheKey = `${font}|${text}`;
  const cached = measurementCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Measure using canvas
  const ctx = getContext();
  if (!ctx) {
    // Fallback: rough estimate based on character count
    return text.length * 8;
  }

  ctx.font = font;
  const width = ctx.measureText(text).width;

  // LRU-style cache management: remove oldest if at capacity
  if (measurementCache.size >= CACHE_MAX_SIZE) {
    const firstKey = measurementCache.keys().next().value;
    if (firstKey) measurementCache.delete(firstKey);
  }

  measurementCache.set(cacheKey, width);
  return width;
}

/**
 * Clear the measurement cache
 * Useful when fonts change or for testing
 */
export function clearMeasurementCache(): void {
  measurementCache.clear();
}

/**
 * Get cache statistics (for debugging/monitoring)
 */
export function getMeasurementCacheStats(): { size: number; maxSize: number } {
  return {
    size: measurementCache.size,
    maxSize: CACHE_MAX_SIZE,
  };
}

// Standard fonts used in TeeemTableView
export const TABLE_FONTS = {
  header: '600 14px ui-sans-serif, system-ui, sans-serif',
  cell: '14px ui-sans-serif, system-ui, sans-serif',
} as const;

// Standard padding values
export const TABLE_PADDING = {
  header: 28, // Sort icon + breathing room
  cell: 24,   // px-3 on each side
} as const;
