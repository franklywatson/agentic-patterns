import { createHash } from 'node:crypto';
import type { Incident } from './types';

const EMAIL = /[^\s"'@]+@[^\s"'@]+\.[^\s"'@]+/;
const SECRET_KEYS = /(password|passwd|token|authorization|cookie|secret|api[-_]?key)/i;
const ID = /^INC-[0-9]{1,9}$/;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
const PATH = /^\/[A-Za-z0-9._~/%-]*$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const ERROR_CLASS = /^[A-Za-z0-9:_.-]+$/;
const ENTRYPOINT = /^(GET|POST|PUT|PATCH|DELETE) \/[A-Za-z0-9._~/:%-]*$/;
const HEADER_NAME = /^[A-Za-z0-9-]+$/;
const HEADER_VALUE = /^[\x20-\x7e]*$/;

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

const check = (ok: boolean, message: string): void => {
  if (!ok) throw new Error(`incident record is invalid: ${message}`);
};

/** Incident records are untrusted input. Every field that reaches generated code or a file path is checked. */
function assertShape(r: Incident): void {
  check(typeof r.id === 'string' && ID.test(r.id), 'id must match INC-<digits>');
  check(typeof r.journey === 'string' && SLUG.test(r.journey), 'journey must be a lowercase slug');
  check(typeof r.entrypoint === 'string' && ENTRYPOINT.test(r.entrypoint), 'entrypoint must be "<METHOD> /path"');
  check(typeof r.errorClass === 'string' && ERROR_CLASS.test(r.errorClass), 'errorClass has unexpected characters');
  check(METHODS.includes(r.request.method), 'request.method is not allowed');
  const paths = [r.request.path, ...(r.replayPaths ?? [])];
  check(paths.every((p) => typeof p === 'string' && PATH.test(p) && !p.split('/').includes('..')), 'request paths must match the path allowlist');
  for (const [name, value] of Object.entries(r.request.headers ?? {})) {
    check(HEADER_NAME.test(name) && typeof value === 'string' && HEADER_VALUE.test(value), `header ${name} has unexpected characters`);
  }
  check(Number.isInteger(r.observed.status) && Number.isInteger(r.expected.status), 'statuses must be integers');
  check(r.expected.body !== null && typeof r.expected.body === 'object', 'expected.body must be an object');
}

/** Validate an incident record: required fields, PII-free request, matching fingerprint. */
export function parseIncident(raw: unknown): Incident {
  const r = raw as Partial<Incident>;
  const required = ['id', 'fingerprint', 'journey', 'entrypoint', 'errorClass', 'request', 'observed', 'expected', 'dependencies'] as const;
  for (const key of required) {
    if (r[key] === undefined) throw new Error(`incident record is missing "${key}"`);
  }
  assertPiiFree(r.request, 'request');
  assertPiiFree(r.observed, 'observed');
  assertPiiFree(r.expected, 'expected');
  assertShape(r as Incident);
  const expected = fingerprintOf(r.entrypoint!, r.observed!.status, r.errorClass!);
  if (r.fingerprint !== expected) {
    throw new Error(`fingerprint ${r.fingerprint} does not match the record (expected ${expected})`);
  }
  return { ...(r as Incident), replayPaths: r.replayPaths ?? [r.request!.path] };
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
