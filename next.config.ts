import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || "/cloud_file_system";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath,
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
