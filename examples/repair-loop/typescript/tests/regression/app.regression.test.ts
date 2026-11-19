// Regression suite for the minimal app. Runs against a deployed stack at
// REGRESSION_BASE_URL. The repair loop runs it on every candidate.
import { randomUUID } from 'node:crypto';
import axios from 'axios';

const http = axios.create({ baseURL: process.env.REGRESSION_BASE_URL, validateStatus: () => true });

describe('regression: minimal app', () => {
  const email = `user-${randomUUID()}@example.test`;
  let userId = '';

  test('base URL is configured', () => {
    expect(process.env.REGRESSION_BASE_URL).toBeDefined();
  });

  test('health reports both dependencies connected', async () => {
    const response = await http.get('/health', { params: { mode: 'prod' } });
    expect(response.status).toBe(200);
    expect(response.data.services.postgres.connected).toBe(true);
    expect(response.data.services.redis.connected).toBe(true);
  });

  test('a user can register and be read back by id', async () => {
    const created = await http.post('/users', { email, username: 'regression', password: 'pw-regression-1' });
    expect(created.status).toBe(201);
    userId = created.data.id;
    const fetched = await http.get(`/users/${userId}`);
    expect(fetched.status).toBe(200);
    expect(fetched.data.email).toBe(email);
  });

  test('a duplicate email is rejected', async () => {
    const duplicate = await http.post('/users', { email, username: 'regression', password: 'pw-regression-2' });
    expect(duplicate.status).toBe(409);
  });

  test('an unknown but well-formed id is 404', async () => {
    const response = await http.get(`/users/${randomUUID()}`);
    expect(response.status).toBe(404);
    expect(response.data).toEqual({ error: 'User not found' });
  });

  test('login returns a session token', async () => {
    const response = await http.post('/auth/login', { email, password: 'pw-regression-1' });
    expect(response.status).toBe(200);
    expect(typeof response.data.token).toBe('string');
  });
});
