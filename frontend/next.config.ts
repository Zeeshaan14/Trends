import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        // Primary R2 public bucket for jersey preview images
        protocol: 'https',
        hostname: 'pub-9b3b5053873140c08ab3e33331892a3a.r2.dev',
      },
      {
        // Custom CDN domain for R2 preview images (cdn.nujerseys.com)
        protocol: 'https',
        hostname: 'cdn.nujerseys.com',
      },
      {
        // ImageKit CDN (if used for image transformations)
        protocol: 'https',
        hostname: 'ik.imagekit.io',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // cdn.razorpay.com required for Razorpay risk-detection bundle — without this the payment handler won't fire
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://checkout.razorpay.com https://cdn.razorpay.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://cdn.razorpay.com https://checkout.razorpay.com https://pub-9b3b5053873140c08ab3e33331892a3a.r2.dev https://ik.imagekit.io",
              // All Razorpay + analytics endpoints needed for the full checkout + payment confirmation flow
              "connect-src 'self' http://localhost:* http://127.0.0.1:* https://api.nujerseys.com https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://lumberjack.razorpay.com https://lumberjack-metrics.razorpay.com wss://*.razorpay.com https://*.vercel-insights.com https://*.r2.cloudflarestorage.com",
              "frame-src https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
