import { Router, type Request, type Response } from 'express';
import { pool, redis } from './infra.js';

async function postgresStatus() {
  const started = Date.now();
  const { rows } = await pool.query('SELECT version() AS version');
  return { connected: true, version: rows[0].version as string, latency_ms: Date.now() - started };
}

async function redisStatus() {
  const started = Date.now();
  const info = await redis.info('server');
  const version = /redis_version:(\S+)/.exec(info)?.[1] ?? 'unknown';
  return { connected: true, version, latency_ms: Date.now() - started };
}

export const health = Router();

// /health serves JSON to API clients and HTML to browsers (content negotiation).
// ?mode=test adds per-service diagnostics (Pattern 1.1, Health Endpoint Test Mode).
health.get('/health', async (req: Request, res: Response) => {
  const body: Record<string, unknown> = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    env: process.env.NODE_ENV ?? 'development',
  };
  if (req.query.mode === 'test') {
    body.services = { postgres: await postgresStatus(), redis: await redisStatus() };
  }
  if (req.accepts(['json', 'html']) === 'html') {
    res.type('html').send(
      `<!doctype html><html><head><title>Health</title></head><body><h1>Status: ${body.status}</h1>` +
        `<p>Checked at ${body.timestamp}</p></body></html>`,
    );
    return;
  }
  res.json(body);
});

health.get('/health/db', async (_req, res) => {
  const pg = await postgresStatus();
  res.json({ database: 'connected', postgres: { version: pg.version } });
});

health.get('/health/cache', async (_req, res) => {
  const r = await redisStatus();
  res.json({ cache: 'connected', redis: { version: r.version } });
});
