/**
 * 01-app-startup.stack.test.ts
 *
 * First test in the sequential stack test suite.
 * Verifies that the complete Docker stack starts successfully.
 *
 * Demonstrates:
 * - Stack initialization with dynamic ports
 * - Health endpoint verification
 * - Proper cleanup
 */

import { StackTestUtils } from '../config/stack-utils';

describe('Stack Test: App Startup', () => {
  let utils: StackTestUtils;

  beforeAll(async () => {
    utils = new StackTestUtils();
    await utils.initialize('docker-compose.test.yml');
  }, 60000);

  afterAll(async () => {
    await utils.cleanup();
  }, 30000);

  test('health endpoint returns 200', async () => {
    // Wait for the stack to be ready
    await utils.waitForReady();

    // Primary assertion: health endpoint responds
    const response = await utils.makeRequest('GET', '/health');

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      status: 'ok',
      timestamp: expect.any(String),
    });

    console.log('Stack started successfully on:', response.config.baseURL);
  });

  test('postgres is accessible', async () => {
    const response = await utils.makeRequest('GET', '/health/db');

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      database: 'connected',
      postgres: {
        version: expect.any(String),
      },
    });
  });

  test('redis is accessible', async () => {
    const response = await utils.makeRequest('GET', '/health/cache');

    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({
      cache: 'connected',
      redis: {
        version: expect.any(String),
      },
    });
  });
});
