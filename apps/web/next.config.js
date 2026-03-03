/** @type {import('next').NextConfig} */
const nextConfig = {
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
