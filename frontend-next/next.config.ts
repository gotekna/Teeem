import type { NextConfig } from "next";
import { execSync } from "child_process";
import { withSentryConfig } from "@sentry/nextjs";

// @ts-expect-error - next-pwa has incomplete types
import withPWA from "next-pwa";

// Bundle analyzer (run with ANALYZE=true npm run build)
import withBundleAnalyzer from "@next/bundle-analyzer";

// Get git commit hash at build time
let gitCommitHash = "dev";
try {
  gitCommitHash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Fallback if git is not available
}

// Count total commits for a version-like number (similar to backend's Version model)
let commitCount = "0";
try {
  commitCount = execSync("git rev-list --count HEAD").toString().trim();
} catch {
  // Fallback if git is not available
}

// Build timestamp in ISO format (for deployed time display)
const buildTime = new Date().toISOString();

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  // Allow 127.0.0.1 as a dev origin (Claude Code preview pane uses 127.0.0.1 not localhost)
  allowedDevOrigins: ["127.0.0.1"],
  // Empty turbopack config to silence warning (PDF viewer uses dynamic import with ssr: false)
  turbopack: {},
  // Dev proxy: all /api/* calls from browser go to Next.js (:3000) which forwards to Rails (:3001)
  // This lets the Claude Code preview browser (sandboxed to :3000) reach the Rails backend
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:3001";
    return {
      // beforeFiles: run before Next.js API routes, so all /api/* is proxied to Rails
      beforeFiles: [
        {
          source: "/api/:path*",
          destination: `${backendUrl}/api/:path*`,
        },
      ],
    };
  },
  env: {
    NEXT_PUBLIC_GIT_COMMIT: gitCommitHash,
    NEXT_PUBLIC_BUILD_NUMBER: commitCount,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
  experimental: {
    optimizePackageImports: [
      "recharts",
      "@tiptap/starter-kit",
      "@tiptap/react",
      "@tiptap/pm",
      "date-fns",
      "@radix-ui/react-icons",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@xyflow/react",
    ],
  },
};

// PWA Configuration
const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Cache strategies for offline support
  runtimeCaching: [
    {
      // Cache API calls with network-first strategy
      urlPattern: /^https:\/\/.*\/api\/v1\/.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        networkTimeoutSeconds: 10,
        cacheableResponse: {
          statuses: [0, 200],
        },
      },
    },
    {
      // Cache static assets with cache-first strategy
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "static-images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        },
      },
    },
    {
      // Cache fonts
      urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
      handler: "CacheFirst",
      options: {
        cacheName: "fonts",
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        },
      },
    },
    {
      // Cache CSS and JS with stale-while-revalidate
      urlPattern: /\.(?:js|css)$/i,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "static-resources",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
      },
    },
    {
      // Cache pages with network-first for offline access
      urlPattern: /^https:\/\/.*\/portal.*/i,
      handler: "NetworkFirst",
      options: {
        cacheName: "portal-pages",
        expiration: {
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 24 hours
        },
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

const analyzedConfig = withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);

export default withSentryConfig(pwaConfig(analyzedConfig), {
  // Suppress source map upload warnings in development
  silent: true,

  // Don't upload source maps (keeps build fast, enable later if needed)
  sourcemaps: {
    disable: true,
  },

  // Automatically tree-shake Sentry logger in production
  disableLogger: true,
});
