/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // 后端 API 反向代理: /api → http://localhost:4000/api
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
