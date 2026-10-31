import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Data comes from large public CSVs fetched at request time and held in an
  // in-process cache (src/lib/data/cache.ts), so pages render dynamically.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
