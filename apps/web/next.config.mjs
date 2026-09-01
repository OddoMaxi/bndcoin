/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@bn/shared-types'],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
