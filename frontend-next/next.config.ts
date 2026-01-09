import type { NextConfig } from "next";
import { execSync } from "child_process";

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
  devIndicators: false,
  // Empty turbopack config to silence warning (PDF viewer uses dynamic import with ssr: false)
  turbopack: {},
  env: {
    NEXT_PUBLIC_GIT_COMMIT: gitCommitHash,
    NEXT_PUBLIC_BUILD_NUMBER: commitCount,
    NEXT_PUBLIC_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
