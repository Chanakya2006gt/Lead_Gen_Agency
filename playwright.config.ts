import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3098",
    trace: "on-first-retry",
    launchOptions: {
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: process.env.CI ? "npx next start -H 127.0.0.1 -p 3098" : "npx next dev -H 127.0.0.1 -p 3098",
    url: "http://127.0.0.1:3098",
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    timeout: 60000,
    env: {
      PORT: "3098",
      ALLOW_INSECURE_LOCAL_AUTH: "true",
      DATABASE_URL: process.env.DATABASE_URL || "./lead_engine.db",
      LEAD_ENGINE_API_SECRET: process.env.LEAD_ENGINE_API_SECRET || "ci-secret-passphrase-testing",
      PLAYWRIGHT_NO_SANDBOX: "true",
    },
  },
});
