import pg from 'pg';
import { createClient } from 'redis';

export const pool = new pg.Pool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME ?? 'testdb',
  user: process.env.DB_USER ?? 'testuser',
  password: process.env.DB_PASSWORD ?? 'testpass',
});

export const redis = createClient({
  url: `redis://${process.env.REDIS_HOST ?? 'localhost'}:${process.env.REDIS_PORT ?? 6379}`,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function initInfra(): Promise<void> {
  await redis.connect();
  await pool.query(SCHEMA);
}
