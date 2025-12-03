import type { NextConfig } from "next";

const nextConfig: any = {
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
  // Empty turbopack config to silence warning (PDF viewer uses dynamic import with ssr: false)
  turbopack: {},
};

export default nextConfig;
