import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { join } from 'node:path';
import axios from 'axios';
import { fingerprintsFromLog } from './incident';
import type { Deployment, Handle, OutboxEntry, RepairEnvironment } from './loop';
import { freezeReproduction, readFrozenHash, sha256File, reproPath } from './reproduce';

export const ROOT = join(__dirname, '..');
export const WORKSPACES = join(ROOT, '.workspaces');

/** Ask the OS for free ports on 127.0.0.1. All sockets stay open until every port is chosen. */
export async function freePorts(count: number): Promise<number[]> {
  const servers = await Promise.all(
    Array.from({ length: count }, () => new Promise<ReturnType<typeof createServer>>((resolve, reject) => {
      const server = createServer();
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => resolve(server));
    })),
  );
  const ports = servers.map((s) => (s.address() as { port: number }).port);
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
  return ports;
}

const run = (cmd: string, args: string[], opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {}) => {
  const result = spawnSync(cmd, args, { encoding: 'utf-8', cwd: opts.cwd, env: opts.env ?? process.env, maxBuffer: 64 * 1024 * 1024 });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
};

export function newWorkspace(label: string): Handle {
  mkdirSync(WORKSPACES, { recursive: true });
  const dir = join(WORKSPACES, `${label}-${process.pid}-${randomBytes(3).toString('hex')}`);
  mkdirSync(dir, { recursive: true });
  const skip = (src: string) => !/(^|\/)(node_modules|dist)(\/|$)/.test(src);
  cpSync(join(ROOT, 'app'), join(dir, 'app'), { recursive: true, filter: skip });
  cpSync(join(ROOT, 'tests', 'regression'), join(dir, 'tests', 'regression'), { recursive: true });
  cpSync(join(ROOT, 'docker-compose.yml'), join(dir, 'docker-compose.yml'));
  mkdirSync(join(dir, '.repair'), { recursive: true });
  return { dir };
}

/** Remove a base workspace and the candidate workspace derived from it. */
export const removeWorkspaces = (base: Handle): void => {
  rmSync(base.dir, { recursive: true, force: true });
  rmSync(`${base.dir}-candidate`, { recursive: true, force: true });
};

export function applyPatch(handle: Handle, patchFile: string): string {
  const patchText = readFileSync(patchFile, 'utf-8');
  const result = run('patch', ['-p1', '--no-backup-if-mismatch', '-s', '-i', patchFile], { cwd: handle.dir });
  if (result.status !== 0) throw new Error(`patch ${patchFile} failed:\n${result.output}`);
  return patchText;
}

export async function deployStack(handle: Handle): Promise<Deployment> {
  const [app, postgres, redis] = await freePorts(3);
  const project = `repair-${process.pid}-${randomBytes(3).toString('hex')}`;
  const env = { ...process.env, APP_PORT: String(app), POSTGRES_PORT: String(postgres), REDIS_PORT: String(redis) };
  const compose = (...args: string[]) =>
    run('docker', ['compose', '-p', project, '-f', join(handle.dir, 'docker-compose.yml'), ...args], { env });
  const up = compose('up', '-d', '--build', '--wait', '--wait-timeout', '180');
  if (up.status !== 0) {
    const logs = compose('logs', '--no-color').output;
    compose('down', '-v', '--remove-orphans', '--rmi', 'local');
    throw new Error(`stack ${project} failed to start:\n${up.output}\n${logs}`);
  }
  return {
    baseUrl: `http://127.0.0.1:${app}`,
    logs: () => compose('logs', '--no-color', 'app').output,
    stop: () => {
      const down = compose('down', '-v', '--remove-orphans', '--rmi', 'local');
      if (down.status !== 0) throw new Error(`compose down failed for ${project}:\n${down.output}`);
    },
  };
}

export function runJest(handle: Handle, pattern: string, baseUrl: string): { passed: boolean; output: string } {
  const jestBin = require.resolve('jest/bin/jest');
  const env: NodeJS.ProcessEnv = { ...process.env, REPRO_BASE_URL: baseUrl, REGRESSION_BASE_URL: baseUrl, CI: '1' };
  delete env.JEST_WORKER_ID;
  const result = run(
    process.execPath,
    [jestBin, '--config', join(ROOT, 'jest.sub.config.cjs'), '--rootDir', handle.dir, '--runInBand', pattern],
    { cwd: ROOT, env },
  );
  return { passed: result.status === 0, output: result.output };
}

const append = (handle: Handle, file: string, entry: unknown) =>
  appendFileSync(join(handle.dir, '.repair', file), `${JSON.stringify(entry)}\n`);

export const readJsonLines = <T>(handle: Handle, file: string): T[] => {
  const path = join(handle.dir, '.repair', file);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
};

/** Real adapters: Docker stacks, Jest subprocesses, GNU patch, JSON-lines outbox and register. */
export interface TestRun { kind: 'reproduction' | 'regression'; workspace: string; passed: boolean; output: string }

export function createEnvironment(): RepairEnvironment & { runs: TestRun[] } {
  const runs: TestRun[] = [];
  return {
    runs,
    now: () => Date.now(),
    async freeze(incident) {
      const handle = newWorkspace(`base-${incident.id}`);
      freezeReproduction(handle.dir, incident);
      return handle;
    },
    async candidate(base, patchFile) {
      const dir = `${base.dir}-candidate`;
      cpSync(base.dir, dir, { recursive: true });
      const handle = { dir };
      const patchText = applyPatch(handle, patchFile);
      return { handle, patchText };
    },
    deploy: deployStack,
    async runReproduction(handle, deployment) {
      const result = runJest(handle, 'tests/repro', deployment.baseUrl);
      runs.push({ kind: 'reproduction', workspace: handle.dir, ...result });
      return result.passed;
    },
    async runRegression(handle, deployment) {
      const result = runJest(handle, 'tests/regression', deployment.baseUrl);
      runs.push({ kind: 'regression', workspace: handle.dir, ...result });
      return result.passed;
    },
    frozenHash: (handle, incident) => readFrozenHash(handle.dir, incident),
    currentHash: (handle, incident) => sha256File(join(handle.dir, reproPath(incident))),
    async traffic(deployment, incident, samples) {
      for (let i = 0; i < samples; i++) {
        await axios.request({
          baseURL: deployment.baseUrl,
          method: incident.request.method,
          url: incident.request.path,
          headers: incident.request.headers,
          validateStatus: () => true,
        });
      }
      const count = fingerprintsFromLog(deployment.logs()).filter((f) => f === incident.fingerprint).length;
      return { samples, fingerprintCount: count };
    },
    emit: (handle, entry: OutboxEntry) => append(handle, 'outbox.jsonl', entry),
    record: (handle, entry) => append(handle, 'register.jsonl', { workflow: 'repair-loop', ts: new Date().toISOString(), ...entry }),
  };
}
