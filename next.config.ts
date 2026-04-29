import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["*.monkeycode-ai.online"],
  reactStrictMode: true,
};

export default nextConfig;
