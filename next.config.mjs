/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/scategories", destination: "/scattegories", permanent: true },
      { source: "/scategories/:path*", destination: "/scattegories/:path*", permanent: true },
    ];
  },
};

export default nextConfig;
