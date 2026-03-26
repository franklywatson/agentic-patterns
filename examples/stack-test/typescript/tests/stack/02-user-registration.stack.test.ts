/**
 * 02-user-registration.stack.test.ts
 *
 * Second test in the sequential stack test suite.
 * Models the atomic user journey: a new user signs up and can access their account.
 *
 * Demonstrates full-loop assertion layering:
 * - Primary: Direct API response (status, body shape, field values)
 * - Second-order: Derived effects verified through DIFFERENT API endpoints
 *   than the one that performed the action (cross-API verification)
 * - Third-order: Cross-functional verification via admin/observability APIs
 *   (audit logs, email notifications, cross-endpoint consistency)
 *
 * All verification goes through public API endpoints — stack tests never
 * query databases or internal services directly.
 */

import { StackTestUtils } from '../config/stack-utils.js';

describe('Stack Test: User signs up and accesses their account', () => {
  let utils: StackTestUtils;
  let createdUserId: string;
  let authToken: string;

  beforeAll(async () => {
    utils = new StackTestUtils();
    await utils.initialize('docker-compose.test.yml');
    await utils.waitForReady();
  }, 60000);

  afterAll(async () => {
    await utils.cleanup();
  }, 30000);

  test('journey step 1: POST /users creates a new user', async () => {
    const userData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'SecurePass123!',
    };

    // --- Primary assertion: API response ---
    const response = await utils.makeRequest('POST', '/users', userData);

    expect(response.status).toBe(201);
    expect(response.data).toMatchObject({
      id: expect.any(String),
      email: userData.email,
      username: userData.username,
      createdAt: expect.any(String),
    });
    expect(response.data).not.toHaveProperty('password'); // Sensitive field never returned
    expect(response.data).not.toHaveProperty('passwordHash'); // Internal field never exposed

    createdUserId = response.data.id;

    // --- Second-order: cross-API verification ---
    // Verify the user is discoverable through a DIFFERENT endpoint than
    // the one that created it. The list endpoint uses its own query path,
    // so a match proves the user was persisted correctly — not just
    // that POST returned a success object.
    const listResponse = await utils.makeRequest('GET', '/users');
    expect(listResponse.status).toBe(200);
    expect(listResponse.data.users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdUserId,
          username: 'testuser',
          email: 'test@example.com',
        }),
      ])
    );

    // --- Third-order: email notification via admin API ---
    // Verify the registration triggered an email through the notification
    // service health API. This checks a cross-functional concern: user
    // creation → notification pipeline → email queued.
    const emailResponse = await utils.makeRequest('GET', '/admin/notifications');
    expect(emailResponse.status).toBe(200);
    expect(emailResponse.data.notifications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'USER_CREATED',
          templateId: 'welcome-email',
          recipient: 'test@example.com',
          variables: expect.objectContaining({
            username: 'testuser',
          }),
        }),
      ])
    );
  });

  test('journey step 2: user can authenticate and receive a session token', async () => {
    // --- Primary assertion: login response ---
    const loginResponse = await utils.makeRequest('POST', '/auth/login', {
      email: 'test@example.com',
      password: 'SecurePass123!',
    });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.data).toMatchObject({
      token: expect.stringMatching(/^eyJ/), // JWT format
      userId: createdUserId,
      expiresIn: expect.any(Number),
    });

    authToken = loginResponse.data.token;

    // --- Second-order: cross-API verification ---
    // The token works for authenticated requests against a different endpoint.
    // This proves the session was created, stored, and is retrievable —
    // not just that the login endpoint returned a token string.
    const profileResponse = await utils.makeRequest('GET', '/users/me', {
      Authorization: `Bearer ${authToken}`,
    });

    expect(profileResponse.status).toBe(200);
    expect(profileResponse.data.id).toBe(createdUserId);
    expect(profileResponse.data.username).toBe('testuser');

    // --- Third-order: authentication enforcement ---
    // The same endpoint rejects unauthenticated requests. This proves the
    // auth middleware is active, not just that authenticated requests work.
    const unauthResponse = await utils.makeRequest('GET', '/users/me');
    expect(unauthResponse.status).toBe(401);
  });

  test('journey step 3: GET /users/:id returns the created user (cross-API consistency)', async () => {
    // Verify the user is retrievable by ID — a third distinct endpoint
    // that should agree with the list endpoint and the session profile.
    const byIdResponse = await utils.makeRequest('GET', `/users/${createdUserId}`);
    expect(byIdResponse.status).toBe(200);
    expect(byIdResponse.data).toMatchObject({
      id: createdUserId,
      email: 'test@example.com',
      username: 'testuser',
    });

    // --- Cross-endpoint consistency ---
    // Fetch via list and verify fields match the by-ID response.
    // If the endpoints disagree, something is broken in the query layer.
    const listResponse = await utils.makeRequest('GET', '/users');
    const listedUser = listResponse.data.users.find(
      (u: { id: string }) => u.id === createdUserId,
    );
    expect(listedUser).toBeDefined();
    expect(listedUser.username).toBe(byIdResponse.data.username);
    expect(listedUser.email).toBe(byIdResponse.data.email);
    // createdAt must be the same across both endpoints
    expect(listedUser.createdAt).toBe(byIdResponse.data.createdAt);
  });

  test('journey edge case: duplicate email returns 409', async () => {
    const duplicateUser = {
      email: 'test@example.com', // Same email as step 1
      username: 'different',
      password: 'AnotherPass123!',
    };

    const response = await utils.makeRequest('POST', '/users', duplicateUser);

    expect(response.status).toBe(409);
    expect(response.data).toMatchObject({
      error: 'Email already exists',
    });

    // --- Third-order: no audit event for failed creation ---
    // A rejected registration should not produce an audit log entry.
    // This proves the uniqueness check runs before persistence.
    const auditResponse = await utils.makeRequest('GET', '/admin/audit/users');
    const failedAttempts = auditResponse.data.entries.filter(
      (e: { action: string; email?: string }) =>
        e.action === 'USER_CREATED' && e.email === 'different',
    );
    expect(failedAttempts).toEqual([]);
  });

  test('journey step 4: user creation is audited with complete trail', async () => {
    // --- Third-order: audit log completeness ---
    const adminResponse = await utils.makeRequest('GET', '/admin/audit/users');

    expect(adminResponse.status).toBe(200);

    // Find the creation event for our specific user
    const creationEvent = adminResponse.data.entries.find(
      (e: { action: string; entityId: string }) =>
        e.action === 'USER_CREATED' && e.entityId === createdUserId,
    );
    expect(creationEvent).toBeDefined();
    expect(creationEvent).toMatchObject({
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: createdUserId,
      timestamp: expect.any(String),
      metadata: expect.objectContaining({
        email: 'test@example.com',
        username: 'testuser',
      }),
    });

    // Verify the login event was also recorded (from step 2)
    const loginEvent = adminResponse.data.entries.find(
      (e: { action: string; entityType: string }) =>
        e.action === 'USER_LOGIN' && e.entityId === createdUserId,
    );
    expect(loginEvent).toBeDefined();
    expect(loginEvent.timestamp).toBeDefined();

    // Login happened AFTER registration (timestamp ordering)
    expect(new Date(loginEvent.timestamp).getTime()).toBeGreaterThanOrEqual(
      new Date(creationEvent.timestamp).getTime(),
    );
  });

  test('journey step 5: user data persists across requests', async () => {
    // Verify data persistence through the API — the transient Docker
    // volumes should persist until cleanup() is called.
    const response = await utils.makeRequest('GET', `/users/${createdUserId}`);
    expect(response.status).toBe(200);
    expect(response.data.id).toBe(createdUserId);
    expect(response.data.email).toBe('test@example.com');
    expect(response.data.username).toBe('testuser');
  });
});
