const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tell Next.js file tracer to start from monorepo root so it can find
  // Prisma engine binaries in pnpm's deep node_modules structure
  outputFileTracingRoot: path.join(__dirname, "../../"),
  transpilePackages: ["@vbt/db", "@vbt/core"],
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), "canvas", "jsdom"];
    return config;
  },
};

module.exports = nextConfig;
