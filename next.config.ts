import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    '21.0.2.223',
    '21.0.15.70',
    'localhost:81',
    'localhost:3000',
  ],
};

export default nextConfig;
