/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/skill.md',
        destination: `${apiUrl}/skill.md`,
      },
      {
        source: '/heartbeat.md',
        destination: `${apiUrl}/heartbeat.md`,
      },
      {
        source: '/openapi.yaml',
        destination: `${apiUrl}/openapi.yaml`,
      },
    ];
  },
};

module.exports = nextConfig;
