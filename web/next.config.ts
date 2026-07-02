import type { NextConfig } from "next";
import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

const nextConfig: NextConfig = {
  // Emit a pure static site to `out/` (no Node server, no node_modules needed
  // to serve). The whole site is SSG, so this exports cleanly.
  output: "export",
  images: { unoptimized: true },
  turbopack: {
    root: import.meta.dirname,
  },
};

export default withMDX(nextConfig);
