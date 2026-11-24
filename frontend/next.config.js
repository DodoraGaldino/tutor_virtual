/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const backendUrl =
      process.env.BACKEND_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "https://tutor-virtual-q3hd.onrender.com";
    return [
      {
        source: "/api/chat",
        destination: `${backendUrl}/chat`,
      },
      {
        source: "/api/history/:path*",
        destination: `${backendUrl}/history/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
