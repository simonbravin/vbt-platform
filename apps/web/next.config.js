const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js file tracer to start from monorepo root
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@vbt/db", "@vbt/core"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
    // Force-include Prisma engine binary that is dynamically loaded
    // (file tracer misses it because it's not a static import)
    outputFileTracingIncludes: {
      "/**": [
        "node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/libquery_engine-*",
        "node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client/runtime/**",
      ],
    },
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), "canvas", "jsdom"];
    return config;
  },
};

module.exports = nextConfig;
