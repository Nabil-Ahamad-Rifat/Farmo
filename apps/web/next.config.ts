import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy: locked to same-origin, with the minimum relaxations
// Next.js/Tailwind need (inline styles for dynamic chart bars, and eval only
// in dev where Next's HMR/react-refresh runtime requires it). 'unsafe-inline'
// in script-src is required without nonces: the App Router streams the RSC
// payload as inline <script>self.__next_f.push(...)</script> tags, and if
// those are blocked React never hydrates — forms then fall back to a native
// GET submit that puts the password in the URL. See "Without Nonces" in
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Other sites can't keep a handle on our window or embed our files (photos
  // included). Google sign-in is a full-page redirect, so it isn't affected.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  // No "preload" yet: that commits every subdomain of the domain to HTTPS for
  // years, and the app still runs on a shared *.vercel.app address. Add it
  // once the farm has its own domain.
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  // Dev-only: Next blocks dev assets/HMR for any origin but localhost, so
  // opening the app via the LAN address (e.g. from a phone) never hydrates.
  // Add more hosts here if the machine's LAN IP changes.
  // The dev machine's LAN address changes (.103, .104, .108 so far), so allow the home network.
  allowedDevOrigins: ["192.168.68.*"],
  transpilePackages: ["@farm/shared-types", "@farm/shared-validation", "@farm/api-client", "@farm/business-logic"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
