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
};

export default nextConfig;
