import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { pool, redis } from './infra.js';

const SESSION_TTL_SECONDS = 3600;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(hash, 'hex'));
}

export const auth = Router();

auth.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const { rows } = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
  if (rows.length === 0 || typeof password !== 'string' || !verifyPassword(password, rows[0].password_hash)) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = randomBytes(24).toString('hex');
  await redis.set(`session:${token}`, rows[0].id, { EX: SESSION_TTL_SECONDS });
  res.json({ token, userId: rows[0].id, expiresIn: SESSION_TTL_SECONDS });
});
