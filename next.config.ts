import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile in $HOME doesn't confuse tracing.
  turbopack: { root: path.join(__dirname) },
};

export default nextConfig;
