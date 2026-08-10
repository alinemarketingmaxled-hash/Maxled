import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default is 0s for dynamic routes (every one of ours, since they all
    // read the session) — so switching between sidebar pages and back
    // always paid a full server round-trip, even seconds later. 30s lets
    // the client reuse what it just fetched for quick back-and-forth
    // navigation. Mutations still show fresh data immediately: every
    // create/update/delete action in this app already calls
    // router.refresh(), which invalidates this cache for the current route
    // regardless of staleTimes.
    staleTimes: {
      dynamic: 30,
    },
  },
  // Security headers (docs/SECURITY-AUDIT.md §6). TLS itself is already
  // enforced by Vercel for every deployment — these just tell the browser
  // to never downgrade, never sniff content types, never frame this app,
  // and never leak the full referrer to a third-party origin.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
