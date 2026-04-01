/**
 * Playwright configuration for browser-driven stack tests.
 *
 * These tests demonstrate the "Beyond API Testing" concept from L1:
 * Stack tests are not limited to driving backend APIs directly. For web
 * applications, the same pattern applies with a browser automation layer.
 * Spin up the full stack, then drive user journeys through the actual UI.
 *
 * The principle remains: real system, real dependencies, no mocks. Only
 * the entry point changes from HTTP API calls to browser interactions.
 *
 * This config assumes the Docker stack is already running (either started
 * by a preceding Jest stack test or manually via docker-compose). Playwright
 * connects to the app's web URL and drives a Chromium browser against it.
 */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Browser test files follow the same sequential naming convention as
  // API stack tests: 01-*, 02-*, etc.
  testDir: './tests/stack/browser',

  // Full match pattern — only files ending in .browser.stack.test.ts
  testMatch: '**/*.browser.stack.test.ts',

  // Sequential execution matches the L1 sequential/additive test pattern.
  // Browser tests are ordered: startup before domain journeys.
  workers: 1,

  // Stack tests need generous timeouts — the stack may be starting up,
  // and page loads depend on real backend services.
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },

  // One retry for flaky browser interactions (e.g., slow page renders).
  // Keep retries low — genuine failures should surface, not be masked.
  retries: 1,

  // Chromium only. Stack tests verify behavior, not cross-browser rendering.
  projects: [
    {
      name: 'chromium',
      use: {
        // The Docker stack's web base URL. Override via BASE_URL env var
        // if the stack runs on a non-default port (dynamic allocation).
        baseURL: process.env.BASE_URL || 'http://localhost:3000',

        // Collect browser console logs for diagnostic signal.
        // If the page throws JavaScript errors, they appear in test output.
        // This is the browser equivalent of checking server logs.
        contextOptions: {
          // Ignore HTTPS errors for local Docker stacks with self-signed certs
          ignoreHTTPSErrors: true,
        },
      },
    },
  ],

  // Don't start a dev server — the Docker stack is managed separately
  // by StackTestUtils (for API tests) or manually.
  // If you want Playwright to manage the stack lifecycle, add a webServer
  // config here pointing at docker-compose.

  // Reporters for CI and local development
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  // Artifacts — capture traces on failure for post-mortem diagnosis.
  // Traces record DOM snapshots, network requests, and console output.
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
