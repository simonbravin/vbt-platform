const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@vbt/db", "@vbt/core"],
  experimental: {
    serverComponentsExternalPackages: ["bcryptjs"],
    // Include the Prisma custom output (engine binary + client) in the Lambda bundle.
    // The client is generated directly inside apps/web so Next.js traces it correctly.
    outputFileTracingIncludes: {
      "/**": [
        ".prisma/client/**",
      ],
    },
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), "canvas", "jsdom"];
    return config;
  },
};

module.exports = nextConfig;
