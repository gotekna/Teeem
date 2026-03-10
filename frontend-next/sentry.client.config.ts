import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only send 10% of transactions in production for performance monitoring
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Disable in development
  enabled: process.env.NODE_ENV === "production",

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    "top.GLOBALS",
    // Network errors users can't control
    "Failed to fetch",
    "NetworkError",
    "Load failed",
    // Auth redirects (expected behavior)
    "NEXT_REDIRECT",
    // ResizeObserver (browser quirk, not a real error)
    "ResizeObserver loop",
    // Stale chunks after new deployment (auto-reloaded by error boundary)
    "ChunkLoadError",
  ],

  // Set environment from build info
  environment: process.env.NODE_ENV,
});
