/** @type {import('next').NextConfig} */

// Security headers applied to every response. Tuned to allow the few external
// origins the app legitimately needs (Discord CDN/login, PayPal SDK, imgur, fonts).
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js needs inline/eval; PayPal SDK is loaded at runtime.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.paypal.com https://www.paypalobjects.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https://i.imgur.com https://cdn.discordapp.com https://www.paypalobjects.com",
      "frame-src https://www.paypal.com https://www.sandbox.paypal.com",
      "connect-src 'self' https://www.paypal.com https://api-m.paypal.com https://api-m.sandbox.paypal.com https://discord.com",
      "form-action 'self' https://discord.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  },
];

const nextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 'cdn.discordapp.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
