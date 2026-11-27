import { defineConfig, devices } from "@playwright/test";

// End-to-end runs record video so a failure, or a flow worth showing, can go
// straight into the capture folder.
//
// `npm run e2e` runs the in-memory flows. `npm run e2e:live` (ARRIS_LIVE=1)
// runs e2e/live.spec.ts against the real back end, resetting the practice
// project's demo before and after.
const live = !!process.env.ARRIS_LIVE;

export default defineConfig({
  testDir: "./e2e",
  testMatch: live ? "live.spec.ts" : "**/*.spec.ts",
  testIgnore: live ? [] : ["live.spec.ts"],
  globalSetup: live ? "./e2e/live-setup.ts" : undefined,
  workers: live ? 1 : undefined,
  timeout: live ? 120_000 : 30_000,
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  outputDir: "test-results",
  use: {
    baseURL: "http://localhost:4173",
    video: "on",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    locale: "en-GB",
    timezoneId: "Europe/London",
  },
  projects: [
    { name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 820 }, hasTouch: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
