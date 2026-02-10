import { defineConfig, devices } from "playwright/test";

const DEFAULT_BASE_URL = "http://tenant.example.com:3000";

const resolveBaseUrl = (): URL => {
  const rawBaseUrl = process.env.PLAYWRIGHT_BASE_URL?.trim();
  if (!rawBaseUrl) {
    return new URL(DEFAULT_BASE_URL);
  }

  return new URL(rawBaseUrl);
};

const baseUrl = resolveBaseUrl();
const normalizedBaseUrl = baseUrl.toString().replace(/\/$/, "");
const normalizedHostname = baseUrl.hostname.trim().toLowerCase();
const requiresHostMapping =
  normalizedHostname !== "localhost" &&
  normalizedHostname !== "127.0.0.1" &&
  normalizedHostname !== "::1";
const hostMappingArg = requiresHostMapping
  ? `--host-resolver-rules=MAP ${normalizedHostname} 127.0.0.1`
  : null;

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: {
    timeout: 10_000
  },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: normalizedBaseUrl,
    headless: process.env.CI ? true : undefined,
    trace: "on-first-retry",
    video: "on-first-retry",
    launchOptions: {
      args: hostMappingArg ? [hostMappingArg] : []
    }
  },
  webServer: {
    command: "pnpm --filter @quiz-factory/web dev --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/api/health",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      CONTENT_SOURCE: "fs",
      NEXT_TELEMETRY_DISABLED: "1"
    }
  }
});
