import { Router } from 'express';
import { pool, redis } from './infra.js';

export const health = Router();

// ?mode=test and ?mode=prod add per-dependency state and the version.
health.get('/health', async (req, res) => {
  const body: Record<string, unknown> = { status: 'ok', version: '1.0.0' };
  if (req.query.mode === 'test' || req.query.mode === 'prod') {
    const started = Date.now();
    await pool.query('SELECT 1');
    const postgresMs = Date.now() - started;
    const redisStarted = Date.now();
    await redis.ping();
    body.services = {
      postgres: { connected: true, latency_ms: postgresMs },
      redis: { connected: true, latency_ms: Date.now() - redisStarted },
    };
  }
  res.json(body);
});
