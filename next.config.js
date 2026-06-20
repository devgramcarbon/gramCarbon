/** @type {import('next').NextConfig} */
const nextConfig = {
  output: undefined,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  serverExternalPackages: ['mongoose', 'bcryptjs', 'winston'],

  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gramcarbon-files.s3.amazonaws.com',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
        ],
      },
    ];
  },
}

module.exports = nextConfig
