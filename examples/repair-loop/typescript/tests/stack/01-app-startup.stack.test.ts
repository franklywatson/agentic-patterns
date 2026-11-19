/**
 * 01-app-startup.stack.test.ts
 *
 * Journey: the base app comes online with PostgreSQL and Redis and reports healthy.
 * Runs first: if it fails, no repair test below it is meaningful.
 */
import axios from 'axios';
import { deployStack, newWorkspace, removeWorkspaces } from '../../src/runtime';
import type { Deployment, Handle } from '../../src/loop';

describe('Stack Test 01: app startup', () => {
  let workspace: Handle;
  let deployment: Deployment;

  beforeAll(async () => {
    workspace = newWorkspace('startup');
    deployment = await deployStack(workspace);
  }, 300000);

  afterAll(() => {
    deployment?.stop();
    if (workspace) removeWorkspaces(workspace);
  }, 120000);

  test('primary: health answers 200 with status ok', async () => {
    const response = await axios.get(`${deployment.baseUrl}/health`);
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ status: 'ok', version: '1.0.0' });
  });

  test('second order: prod mode reports PostgreSQL and Redis connected', async () => {
    const response = await axios.get(`${deployment.baseUrl}/health`, { params: { mode: 'prod' } });
    expect(response.data.services.postgres.connected).toBe(true);
    expect(response.data.services.redis.connected).toBe(true);
  });

  test('second order: a user round-trips through PostgreSQL and a login session lands in Redis', async () => {
    const email = `startup-${Date.now()}@example.test`;
    const created = await axios.post(`${deployment.baseUrl}/users`, { email, username: 'startup', password: 'pw-startup-1' });
    expect(created.status).toBe(201);
    const login = await axios.post(`${deployment.baseUrl}/auth/login`, { email, password: 'pw-startup-1' });
    expect(login.status).toBe(200);
    expect(login.data.userId).toBe(created.data.id);
  });

  test('third order: the app logs no unhandled errors during startup', () => {
    expect(deployment.logs()).not.toContain('unhandled_error');
  });
});
