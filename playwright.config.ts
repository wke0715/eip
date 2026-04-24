import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
dotenv.config({ path: ".env.test" });
dotenv.config({ path: ".env.railway-test", override: true });

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const isRemote = !!process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : 2,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
    // Railway 網路延遲較高，server action 需要更多時間
    ...(isRemote && { actionTimeout: 15000 }),
  },
  expect: {
    timeout: isRemote ? 15000 : 5000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  ...(isRemote
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: !process.env.CI,
        },
      }),
});
