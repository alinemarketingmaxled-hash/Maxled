// Stand-in for the "server-only" marker package under Vitest — Next.js's
// own bundler swaps it for a no-op inside server bundles; outside that
// bundler it unconditionally throws, which would break every unit/
// integration test that imports a "server-only" lib file. See
// vitest.config.ts's resolve.alias.
export {};
