/**
 * Browser-side PDF caching using the Cache API
 *
 * This provides instant loading for repeat PDF views by caching
 * the PDF blob in the browser after first fetch.
 *
 * Cache behavior:
 * - 7 day TTL (configurable)
 * - Automatically cleans up expired entries
 * - Falls back gracefully if Cache API unavailable
 */

import { CACHE_EXPIRY_PDF } from './constants/cache-constants';

const PDF_CACHE_NAME = "teeem-pdf-cache-v1";
// SSoT: Uses CACHE_EXPIRY_PDF from cache-constants.ts
const CACHE_MAX_AGE_MS = CACHE_EXPIRY_PDF;

/**
 * Check if Cache API is available (not available in some contexts like incognito)
 */
function isCacheAvailable(): boolean {
  return typeof caches !== "undefined";
}

/**
 * Get a cached PDF blob by URL
 * Returns null if not cached or expired
 */
export async function getCachedPdf(url: string): Promise<Blob | null> {
  if (!isCacheAvailable()) return null;

  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    const response = await cache.match(url);

    if (response) {
      // Check if cache is still fresh
      const cachedAt = response.headers.get("x-cached-at");
      if (cachedAt) {
        const age = Date.now() - parseInt(cachedAt, 10);
        if (age < CACHE_MAX_AGE_MS) {
          return await response.blob();
        } else {
          // Expired - delete it
          await cache.delete(url);
        }
      }
    }
    return null;
  } catch (err) {
    console.warn("[PDF Cache] Read error:", err);
    return null;
  }
}

/**
 * Cache a PDF blob for future instant loading
 */
export async function cachePdf(url: string, blob: Blob): Promise<void> {
  if (!isCacheAvailable()) return;

  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    const response = new Response(blob, {
      headers: {
        "Content-Type": "application/pdf",
        "x-cached-at": Date.now().toString(),
      },
    });
    await cache.put(url, response);
  } catch (err) {
    console.warn("[PDF Cache] Write error:", err);
  }
}

/**
 * Clear the entire PDF cache
 * Useful for: logout, storage management, debugging
 */
export async function clearPdfCache(): Promise<void> {
  if (!isCacheAvailable()) return;

  try {
    await caches.delete(PDF_CACHE_NAME);
  } catch (err) {
    console.warn("[PDF Cache] Clear error:", err);
  }
}

/**
 * Remove a specific PDF from cache
 * Useful when a document is updated
 */
export async function removeCachedPdf(url: string): Promise<void> {
  if (!isCacheAvailable()) return;

  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    await cache.delete(url);
  } catch (err) {
    console.warn("[PDF Cache] Remove error:", err);
  }
}

/**
 * Get cache statistics (for debugging/admin)
 */
export async function getPdfCacheStats(): Promise<{
  count: number;
  urls: string[];
} | null> {
  if (!isCacheAvailable()) return null;

  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    const keys = await cache.keys();
    return {
      count: keys.length,
      urls: keys.map((req) => req.url),
    };
  } catch {
    return null;
  }
}
