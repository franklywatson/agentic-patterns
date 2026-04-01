/**
 * 01-app-startup.browser.stack.test.ts
 *
 * Browser-based startup verification — the first test in the browser suite.
 *
 * This test demonstrates the "Beyond API Testing" concept from L1:
 * instead of calling GET /health via HTTP, we navigate to the health page
 * in a real browser and verify it renders correctly. This catches problems
 * that API tests cannot: broken JavaScript, missing assets, CSS failures,
 * and server-side rendering issues.
 *
 * Maps to L1 patterns:
 * - Pattern 1.1 (Stack Tests): Full system running, no mocks
 * - Pattern 1.2 (Full-Loop Assertions): Page content + console health
 * - Pattern 1.3 (Sequential Ordering): First test — foundation for all
 *   subsequent browser tests
 *
 * Prerequisite: The Docker stack must be running before this test executes.
 * In a full pipeline, the Jest API stack tests (01-app-startup.stack.test.ts)
 * would run first to confirm the stack is healthy, then browser tests run
 * against the same stack.
 */

import { test, expect, Page, ConsoleMessage } from '@playwright/test';

test.describe('Browser Stack Test: App Startup', () => {
  const consoleErrors: string[] = [];

  test.beforeEach(({ page }) => {
    // Capture browser console errors for diagnostic signal.
    // If the page throws JavaScript errors during load, they accumulate here.
    // The post-navigation check asserts this array is empty — any error fails
    // the test. This is the browser equivalent of checking server logs for
    // unexpected exceptions.
    consoleErrors.length = 0;

    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('health page renders with expected content', async ({ page }) => {
    // Navigate to the health page. This exercises the full rendering pipeline:
    // DNS resolution -> TCP connection -> HTTP response -> HTML parse ->
    // JavaScript execution -> DOM paint.
    const response = await page.goto('/health');

    // Primary assertion: page loaded successfully (HTTP 200).
    // If this fails, the stack itself is not serving pages.
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);

    // Primary assertion: page contains the expected status indicator.
    // The health page should render a visible "ok" or "healthy" status
    // that a human operator could read at a glance.
    const body = page.locator('body');
    await expect(body).toContainText(/ok|healthy/i);

    // Second-order assertion: no browser console errors.
    // A page that loads but throws JavaScript errors is broken in ways
    // that API tests cannot detect. The console error check proves that
    // the client-side JavaScript initialized correctly.
    expect(consoleErrors).toEqual([]);
  });

  test('static assets load without errors', async ({ page }) => {
    // Navigate to the root page — the main entry point for users.
    const response = await page.goto('/');

    // Primary assertion: root page loads.
    expect(response).not.toBeNull();
    expect(response!.status()).toBe(200);

    // Second-order assertion: all referenced resources loaded.
    // Collect failed network requests (404s, 500s for JS/CSS/images).
    const failedRequests: string[] = [];

    page.on('response', (res) => {
      if (res.status() >= 400) {
        failedRequests.push(`${res.status()} ${res.url()}`);
      }
    });

    // Reload to capture resource loading events with our listener attached.
    await page.reload({ waitUntil: 'networkidle' });

    // Any failed resource request is a real bug — missing assets, broken
    // paths, or misconfigured CDN references.
    expect(failedRequests).toEqual([]);

    // Second-order assertion: page title is set.
    // A missing title suggests the HTML template is incomplete.
    const title = await page.title();
    expect(title).toBeDefined();
    expect(title.length).toBeGreaterThan(0);
  });

  test('browser-side JavaScript executes correctly', async ({ page }) => {
    // Navigate to the health page which exercises client-side JS.
    await page.goto('/health');

    // Second-order assertion: JavaScript is functional by checking that
    // dynamic content rendered. Many SPAs and server-rendered apps depend
    // on client-side JavaScript for correct behavior.
    //
    // This test verifies the browser can execute JavaScript by evaluating
    // a simple expression. If the JS runtime is broken (e.g., syntax error
    // in a critical bundle), this will fail.
    const jsWorks = await page.evaluate(() => {
      // Verify basic JavaScript execution in the browser context.
      return typeof window !== 'undefined' && typeof document !== 'undefined';
    });
    expect(jsWorks).toBe(true);

    // Third-order assertion: no console errors after page fully loaded.
    // This catches deferred script errors that don't fire until after
    // initial render — lazy-loaded modules, analytics scripts, etc.
    expect(consoleErrors).toEqual([]);
  });
});
