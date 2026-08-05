import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Pin the Turbopack workspace root to THIS project directory. Without this,
  // Next.js detects multiple package-lock.json files (one at the parent
  // "d:\Gamers of Bangladesh" level) and treats the parent as the root,
  // causing it to scan the entire parent tree (node_modules, .git, etc.) on
  // every change — which hangs the machine during `npm run dev`.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
