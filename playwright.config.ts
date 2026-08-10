import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Some sandboxed dev environments ship a pre-installed Chromium at a fixed
// path instead of the one Playwright would normally download — use it when
// present so `npx playwright install` isn't required there; everywhere
// else (a real machine, CI with its own Playwright browser cache) this is
// simply undefined and Playwright resolves its browser the normal way.
const sandboxChromium = "/opt/pw-browsers/chromium";
const executablePath = existsSync(sandboxChromium) ? sandboxChromium : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
});
