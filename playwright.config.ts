import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "line",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer:
    process.env.PLAYWRIGHT_EXTERNAL_SERVER === "1"
      ? undefined
      : {
          command: "npm start",
          env: {
            AUTH_SECRET: process.env.AUTH_SECRET ?? "fasttrack-local-e2e-secret-change-in-production",
          },
          url: "http://localhost:3000",
          reuseExistingServer: true,
        },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
