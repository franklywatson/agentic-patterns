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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry a start-up step for about 30 seconds: the dependencies may still be starting. */
async function untilReady(step: () => Promise<unknown>): Promise<void> {
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      await step();
      return;
    } catch (error) {
      if (Date.now() > deadline) throw error;
      await sleep(1000);
    }
  }
}

export async function initInfra(): Promise<void> {
  await untilReady(() => redis.connect());
  await untilReady(() => pool.query(SCHEMA));
}
