import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@ai-trip-planner/api-client",
    "@ai-trip-planner/core",
    "@ai-trip-planner/domain",
  ],
};

export default nextConfig;
