import { createHash } from 'node:crypto';
import type { Incident } from './types';

const EMAIL = /[^\s"'@]+@[^\s"'@]+\.[^\s"'@]+/;
const SECRET_KEYS = /^(password|passwd|token|authorization|cookie|secret)$/i;

export function fingerprintOf(entrypoint: string, status: number, errorClass: string): string {
  return createHash('sha256').update(`${entrypoint}|${status}|${errorClass}`).digest('hex').slice(0, 12);
}

function assertPiiFree(value: unknown, path: string): void {
  if (typeof value === 'string' && EMAIL.test(value)) {
    throw new Error(`incident record contains an email address at ${path}`);
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (SECRET_KEYS.test(key)) throw new Error(`incident record contains a secret field at ${path}.${key}`);
      assertPiiFree(child, `${path}.${key}`);
    }
  }
}

/** Validate an incident record: required fields, PII-free request, matching fingerprint. */
export function parseIncident(raw: unknown): Incident {
  const r = raw as Partial<Incident>;
  const required = ['id', 'fingerprint', 'journey', 'entrypoint', 'errorClass', 'request', 'observed', 'expected', 'dependencies'] as const;
  for (const key of required) {
    if (r[key] === undefined) throw new Error(`incident record is missing "${key}"`);
  }
  assertPiiFree(r.request, 'request');
  const expected = fingerprintOf(r.entrypoint!, r.observed!.status, r.errorClass!);
  if (r.fingerprint !== expected) {
    throw new Error(`fingerprint ${r.fingerprint} does not match the record (expected ${expected})`);
  }
  return r as Incident;
}

/** Extract fingerprints from structured error lines in application logs. */
export function fingerprintsFromLog(logText: string): string[] {
  const found: string[] = [];
  for (const line of logText.split('\n')) {
    const start = line.indexOf('{');
    if (start === -1) continue;
    let entry: { event?: string; route?: string; status?: number; errorClass?: string };
    try {
      entry = JSON.parse(line.slice(start));
    } catch {
      continue; // not a JSON log line (compose prefix only, or plain text)
    }
    if (entry.event === 'unhandled_error' && entry.route && entry.status && entry.errorClass) {
      found.push(fingerprintOf(entry.route, entry.status, entry.errorClass));
    }
  }
  return found;
}
