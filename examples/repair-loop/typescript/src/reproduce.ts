import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { Incident } from './types';

export const REPRO_DIR = 'tests/repro';

export const reproPath = (incident: Incident): string => `${REPRO_DIR}/${incident.id}.repro.test.ts`;

/** Render the reproduction stack test. It asserts the invariant: the expected status and body. */
export function renderReproduction(incident: Incident): string {
  const { request, expected } = incident;
  return `// Reproduction for ${incident.id} (fingerprint ${incident.fingerprint}), journey ${incident.journey}.
// Generated from the incident record. Frozen before any fix is written.
import axios from 'axios';

describe('${incident.id} reproduction: ${incident.journey}', () => {
  test('${request.method} ${request.path} answers as expected', async () => {
    expect(process.env.REPRO_BASE_URL).toBeDefined();
    const response = await axios.request({
      baseURL: process.env.REPRO_BASE_URL,
      method: ${JSON.stringify(request.method)},
      url: ${JSON.stringify(request.path)},
      headers: ${JSON.stringify(request.headers)},
      validateStatus: () => true,
    });
    expect(response.status).toBe(${expected.status});
    expect(response.data).toEqual(${JSON.stringify(expected.body)});
  });
});
`;
}

export const sha256File = (path: string): string => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Write the reproduction into a workspace and record its hash in the lock file. */
export function freezeReproduction(workspace: string, incident: Incident): { path: string; sha256: string } {
  const rel = reproPath(incident);
  const abs = join(workspace, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, renderReproduction(incident));
  const sha256 = sha256File(abs);
  const lock = join(workspace, '.repair', `${incident.id}.lock.json`);
  mkdirSync(dirname(lock), { recursive: true });
  writeFileSync(lock, JSON.stringify({ incidentId: incident.id, path: rel, sha256 }, null, 2));
  return { path: rel, sha256 };
}

export function readFrozenHash(workspace: string, incident: Incident): string {
  const lock = JSON.parse(readFileSync(join(workspace, '.repair', `${incident.id}.lock.json`), 'utf-8'));
  return lock.sha256 as string;
}
