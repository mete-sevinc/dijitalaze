import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Force all pages to be dynamic (server-rendered) - needed for DB access
  },
};

export default nextConfig;
