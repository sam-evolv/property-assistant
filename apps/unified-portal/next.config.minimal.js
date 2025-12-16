/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['@openhouse/api', '@openhouse/auth', '@openhouse/db', '@openhouse/workers'],
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: { serverActions: { bodySizeLimit: '10mb' } },
  images: { unoptimized: true },
  poweredByHeader: false,
};
module.exports = nextConfig;
