/** @type {import('next').NextConfig} */

// Security headers applied to every response. These protect against
// clickjacking, MIME-sniffing, XSS, and force HTTPS on supporting browsers.
// Adjust the CSP `connect-src`/`img-src` if you add new third-party APIs.
//
// 'unsafe-eval' is added to script-src ONLY in development: Next.js's dev
// server (Fast Refresh / HMR) evaluates code via eval() under the hood,
// and a CSP without 'unsafe-eval' silently blocks that — the client JS
// bundle fails to run at all, which looks like "nothing on the page
// responds to clicks" rather than a visible error. Production builds
// don't need eval(), so the stricter policy still applies when deployed.
const isDev = process.env.NODE_ENV !== 'production';

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://maps.googleapis.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't advertise "X-Powered-By: Next.js"
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

module.exports = nextConfig;
