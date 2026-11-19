import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { hashPassword } from '../auth.js';
import { pool } from '../infra.js';

export const users = Router();

const view = (r: { id: string; email: string; username: string; created_at: Date }) => ({
  id: r.id,
  email: r.email,
  username: r.username,
  createdAt: r.created_at.toISOString(),
});

users.post('/users', async (req, res) => {
  const { email, username, password } = req.body ?? {};
  if (![email, username, password].every((v) => typeof v === 'string' && v.length > 0)) {
    res.status(400).json({ error: 'email, username and password are required' });
    return;
  }
  const inserted = await pool.query(
    `INSERT INTO users (id, email, username, password_hash) VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO NOTHING RETURNING id, email, username, created_at`,
    [randomUUID(), email, username, hashPassword(password)],
  );
  if (inserted.rowCount === 0) {
    res.status(409).json({ error: 'Email already exists' });
    return;
  }
  res.status(201).json(view(inserted.rows[0]));
});

users.get('/users/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, username, created_at FROM users WHERE id = $1',
    [req.params.id],
  );
  if (rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(view(rows[0]));
});
