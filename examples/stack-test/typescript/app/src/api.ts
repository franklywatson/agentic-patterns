import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { Router, type Request, type Response, type NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool, redis } from './infra.js';

const JWT_SECRET = process.env.JWT_SECRET ?? 'stack-test-secret';
const TOKEN_TTL_SECONDS = 3600;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

async function requireSession(req: Request, res: Response, next: NextFunction) {
  const header = req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    jwt.verify(token, JWT_SECRET);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
  const userId = await redis.get(`session:${token}`);
  if (!userId) {
    res.status(401).json({ error: 'Session expired' });
    return;
  }
  res.locals.userId = userId;
  next();
}

const publicUser = (r: { id: string; email: string; username: string; created_at: Date }) => ({
  id: r.id,
  email: r.email,
  username: r.username,
  createdAt: r.created_at.toISOString(),
});

export const api = Router();

api.post('/users', async (req, res) => {
  const { email, username, password } = req.body ?? {};
  if (![email, username, password].every((v) => typeof v === 'string' && v.length > 0)) {
    res.status(400).json({ error: 'email, username and password are required' });
    return;
  }
  const id = randomUUID();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT (email) DO NOTHING RETURNING id, email, username, created_at`,
      [id, email, username, hashPassword(password)],
    );
    if (inserted.rowCount === 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ error: 'Email already exists' });
      return;
    }
    await client.query(
      `INSERT INTO audit_log (action, entity_type, entity_id, metadata) VALUES ('USER_CREATED', 'user', $1, $2)`,
      [id, { email, username }],
    );
    await client.query(
      `INSERT INTO notifications (event_type, template_id, recipient, variables)
       VALUES ('USER_CREATED', 'welcome-email', $1, $2)`,
      [email, { username }],
    );
    await client.query('COMMIT');
    res.status(201).json(publicUser(inserted.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});

api.get('/users', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, email, username, created_at FROM users ORDER BY created_at');
  res.json({ users: rows.map(publicUser) });
});

api.get('/users/me', requireSession, async (_req, res) => {
  const { rows } = await pool.query('SELECT id, email, username, created_at FROM users WHERE id = $1', [
    res.locals.userId,
  ]);
  res.json(publicUser(rows[0]));
});

api.get('/users/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, username, created_at FROM users WHERE id::text = $1',
    [req.params.id],
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(publicUser(rows[0]));
});

api.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
  if (rows.length === 0 || typeof password !== 'string' || !verifyPassword(password, rows[0].password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const userId: string = rows[0].id;
  const token = jwt.sign({ sub: userId, jti: randomUUID() }, JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
  await redis.set(`session:${token}`, userId, { EX: TOKEN_TTL_SECONDS });
  await pool.query(
    `INSERT INTO audit_log (action, entity_type, entity_id, metadata) VALUES ('USER_LOGIN', 'user', $1, $2)`,
    [userId, { email }],
  );
  res.json({ token, userId, expiresIn: TOKEN_TTL_SECONDS });
});

api.get('/admin/audit/users', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT action, entity_type, entity_id, metadata, created_at FROM audit_log ORDER BY id',
  );
  res.json({
    entries: rows.map((r) => ({
      action: r.action,
      entityType: r.entity_type,
      entityId: r.entity_id,
      metadata: r.metadata,
      timestamp: r.created_at.toISOString(),
    })),
  });
});

api.get('/admin/notifications', async (_req, res) => {
  const { rows } = await pool.query(
    'SELECT event_type, template_id, recipient, variables FROM notifications ORDER BY id',
  );
  res.json({
    notifications: rows.map((r) => ({
      eventType: r.event_type,
      templateId: r.template_id,
      recipient: r.recipient,
      variables: r.variables,
    })),
  });
});
