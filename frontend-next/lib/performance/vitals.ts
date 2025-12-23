/**
 * Performance Observatory - Web Vitals Reporter
 *
 * Collects Core Web Vitals (LCP, FID, CLS, INP, TTFB) and sends them
 * to the backend for storage and analysis.
 *
 * Features:
 * - Batched reporting (collects multiple metrics before sending)
 * - Beacon API for reliable delivery (even on page unload)
 * - Fallback to fetch for immediate sends
 * - Session tracking for user journey analysis
 *
 * Usage:
 *   import { initVitals } from '@/lib/performance/vitals'
 *   // In your root layout or app component:
 *   useEffect(() => { initVitals() }, [])
 */

import { onCLS, onLCP, onINP, onTTFB, type Metric } from "web-vitals";

// Configuration
const METRICS_ENDPOINT = "/api/v1/metrics";
const BATCH_SIZE = 5; // Send after collecting this many metrics
const FLUSH_INTERVAL_MS = 30000; // Flush every 30 seconds regardless

// Generate a session ID for tracking user journeys
const SESSION_ID =
  typeof window !== "undefined"
    ? `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    : "server";

// Metrics buffer
let metricsBuffer: MetricPayload[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

interface MetricPayload {
  metric_name: string;
  value: number;
  rating: string;
  page_path: string;
  metadata?: Record<string, unknown>;
}

/**
 * Initialize Web Vitals collection
 * Call this once in your root layout or app component
 */
export function initVitals(): void {
  if (typeof window === "undefined") return;

  // Register handlers for each Core Web Vital
  onCLS(handleMetric);
  onFID(handleMetric);
  onLCP(handleMetric);
  onINP(handleMetric);
  onTTFB(handleMetric);

  // Set up periodic flush
  startFlushTimer();

  // Flush on page unload
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushMetrics();
    }
  });

  // Flush before navigating away
  window.addEventListener("pagehide", () => {
    flushMetrics();
  });
}

/**
 * Handle a Web Vital metric
 */
function handleMetric(metric: Metric): void {
  const payload: MetricPayload = {
    metric_name: metric.name,
    value: metric.value,
    rating: metric.rating,
    page_path: typeof window !== "undefined" ? window.location.pathname : "",
    metadata: {
      id: metric.id,
      navigation_type: metric.navigationType,
      entries: metric.entries?.map((e) => ({
        name: e.name,
        entryType: e.entryType,
        startTime: e.startTime,
      })),
    },
  };

  metricsBuffer.push(payload);

  // Flush if buffer is full
  if (metricsBuffer.length >= BATCH_SIZE) {
    flushMetrics();
  }
}

/**
 * Start the periodic flush timer
 */
function startFlushTimer(): void {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(() => {
    flushMetrics();
    startFlushTimer(); // Restart timer
  }, FLUSH_INTERVAL_MS);
}

/**
 * Flush collected metrics to the backend
 * Uses Beacon API for reliability, falls back to fetch
 */
function flushMetrics(): void {
  if (metricsBuffer.length === 0) return;

  // Grab current buffer and reset
  const metrics = [...metricsBuffer];
  metricsBuffer = [];

  const payload = JSON.stringify({
    metrics,
    session_id: SESSION_ID,
  });

  // Try Beacon API first (most reliable for page unloads)
  if (navigator.sendBeacon) {
    const success = navigator.sendBeacon(
      METRICS_ENDPOINT,
      new Blob([payload], { type: "application/json" })
    );

    if (success) {
      return;
    }
  }

  // Fallback to fetch
  fetch(METRICS_ENDPOINT, {
    method: "POST",
    body: payload,
    headers: {
      "Content-Type": "application/json",
    },
    // Use keepalive to ensure request completes even if page unloads
    keepalive: true,
  }).catch(() => {
    // Silently fail - we don't want to impact user experience
    // Metrics are best-effort, not critical
  });
}

/**
 * Report a custom performance metric
 * Use this for application-specific timings
 *
 * Example:
 *   reportCustomMetric('table_render', 150, { table: 'jobs', rows: 100 })
 */
export function reportCustomMetric(
  name: string,
  value: number,
  metadata?: Record<string, unknown>
): void {
  const payload: MetricPayload = {
    metric_name: name,
    value,
    rating: "custom",
    page_path: typeof window !== "undefined" ? window.location.pathname : "",
    metadata,
  };

  metricsBuffer.push(payload);

  // Custom metrics flush immediately (they're typically important)
  flushMetrics();
}

/**
 * Get the current session ID
 * Useful for correlating frontend metrics with backend logs
 */
export function getSessionId(): string {
  return SESSION_ID;
}
