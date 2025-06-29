// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1) Proxy /api/camera/* to your FastAPI server
  async rewrites() {
    return [
      {
        source: "/api/camera/:path*",
        destination: "http://localhost:8000/:path*",
      },
    ];
  },

  // 2) Your existing SVG loader
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ["@svgr/webpack"],
    });
    return config;
  },
};

export default nextConfig;
