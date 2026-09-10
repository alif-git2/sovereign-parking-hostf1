/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  async headers() {
    const noIndexHeaders = [
      {
        key: "X-Robots-Tag",
        value: "noindex, nofollow, noarchive",
      },
    ];

    return [
      { source: "/admin/:path*", headers: noIndexHeaders },
      { source: "/customer/:path*", headers: noIndexHeaders },
      { source: "/login", headers: noIndexHeaders },
      { source: "/forget-password", headers: noIndexHeaders },
      { source: "/reset-password", headers: noIndexHeaders },
      { source: "/set-password", headers: noIndexHeaders },
      { source: "/verify-otp", headers: noIndexHeaders },
      { source: "/booking/payment/:path*", headers: noIndexHeaders },
      { source: "/booking/paypal/:path*", headers: noIndexHeaders },
      { source: "/booking/success", headers: noIndexHeaders },
      { source: "/wallet/:path*", headers: noIndexHeaders },
      { source: "/backend/:path*", headers: noIndexHeaders },
    ];
  },
};

export default nextConfig;
