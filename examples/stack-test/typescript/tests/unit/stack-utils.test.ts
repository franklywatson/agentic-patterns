/**
 * Unit tests for StackTestUtils. `child_process` is replaced so no Docker command runs;
 * the stack tests under tests/stack exercise the real Docker path.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';
import { StackTestUtils } from '../config/stack-utils';

jest.mock('child_process');
const execSyncMock = execSync as unknown as jest.Mock;

const TEMPLATE = 'app: ${APP_PORT:-3000}\npostgres: ${POSTGRES_PORT:-5432}\nredis: ${REDIS_PORT:-6379}\n';

let templateDir: string;
let template: string;
let cwdFiles: string[];

beforeEach(() => {
  execSyncMock.mockReset();
  templateDir = mkdtempSync(join(tmpdir(), 'stack-utils-'));
  template = join(templateDir, 'template.yml');
  writeFileSync(template, TEMPLATE);
  cwdFiles = [];
  jest.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  for (const file of cwdFiles) {
    rmSync(file, { force: true });
  }
  rmSync(templateDir, { recursive: true, force: true });
  jest.restoreAllMocks();
});

async function started(utils: StackTestUtils) {
  const config = await utils.initialize(template);
  cwdFiles.push(config.composeFile);
  return config;
}

describe('initialize', () => {
  it('allocates three distinct ports in range and writes them into the compose file', async () => {
    const config = await started(new StackTestUtils());
    const ports = [config.ports.app, config.ports.postgres, config.ports.redis];
    expect(new Set(ports).size).toBe(3);
    for (const port of ports) {
      expect(port).toBeGreaterThanOrEqual(10000);
      expect(port).toBeLessThanOrEqual(65535);
    }
    expect(config.baseUrl).toBe(`http://localhost:${config.ports.app}`);
    expect(readFileSync(config.composeFile, 'utf-8')).toBe(
      `app: ${config.ports.app}\npostgres: ${config.ports.postgres}\nredis: ${config.ports.redis}\n`,
    );
  });

  it('starts the stack under a unique compose project name', async () => {
    const first = await started(new StackTestUtils());
    const second = await started(new StackTestUtils());
    expect(first.composeFile).not.toBe(second.composeFile);
    const upCommands = execSyncMock.mock.calls.map(([cmd]) => String(cmd)).filter((cmd) => cmd.includes(' up -d --build'));
    expect(upCommands).toHaveLength(2);
    const names = upCommands.map((cmd) => /-p "([^"]+)"/.exec(cmd)![1]);
    expect(names[0]).not.toBe(names[1]);
    expect(names[0]).toMatch(/^stack-test-/);
  });

  it('never returns the same port twice even when the random source repeats a value', async () => {
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.5)
      .mockReturnValueOnce(0.25)
      .mockReturnValueOnce(0.25)
      .mockReturnValue(0.75);
    const config = await started(new StackTestUtils());
    expect(new Set([config.ports.app, config.ports.postgres, config.ports.redis]).size).toBe(3);
  });

  it('throws when no free port is found within the attempt limit', async () => {
    execSyncMock.mockImplementation(() => {
      throw new Error('port in use');
    });
    await expect(new StackTestUtils().initialize(template)).rejects.toThrow('Could not allocate 3 ports');
  });
});

describe('cleanup', () => {
  it('runs docker compose down -v --remove-orphans for its project and deletes the compose file', async () => {
    const utils = new StackTestUtils();
    const config = await started(utils);
    execSyncMock.mockClear();
    await utils.cleanup();
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    const command = String(execSyncMock.mock.calls[0][0]);
    expect(command).toContain('down -v --remove-orphans');
    expect(command).toContain(config.composeFile);
    expect(existsSync(config.composeFile)).toBe(false);
  });

  it('reports a failed docker compose down, and still deletes the compose file', async () => {
    const utils = new StackTestUtils();
    const config = await started(utils);
    execSyncMock.mockImplementation(() => {
      throw new Error('daemon unreachable');
    });
    await expect(utils.cleanup()).rejects.toThrow(/Cleanup of stack stack-test-.* failed.*daemon unreachable/);
    expect(existsSync(config.composeFile)).toBe(false);
  });

  it('reports both failures when docker compose down and the compose file removal fail', async () => {
    const utils = new StackTestUtils();
    const config = await started(utils);
    execSyncMock.mockImplementation(() => {
      throw new Error('daemon unreachable');
    });
    // A directory in place of the compose file makes unlinkSync fail.
    rmSync(config.composeFile);
    mkdirSync(config.composeFile);
    writeFileSync(join(config.composeFile, 'keep'), '');
    try {
      await expect(utils.cleanup()).rejects.toThrow(/docker compose down: daemon unreachable; remove .*stack-test.*: E/);
    } finally {
      rmSync(config.composeFile, { recursive: true, force: true });
    }
  });

  it('can retry a failed docker compose down by project name after the compose file is gone', async () => {
    const utils = new StackTestUtils();
    const config = await started(utils);
    const project = /-p "([^"]+)"/.exec(String(execSyncMock.mock.calls.at(-1)?.[0]))![1];
    execSyncMock.mockImplementationOnce(() => {
      throw new Error('daemon unreachable');
    });
    await expect(utils.cleanup()).rejects.toThrow(/daemon unreachable/);
    expect(existsSync(config.composeFile)).toBe(false);
    execSyncMock.mockClear();
    await utils.cleanup();
    expect(execSyncMock).toHaveBeenCalledTimes(1);
    expect(String(execSyncMock.mock.calls[0][0])).toBe(`docker compose -p "${project}" down -v --remove-orphans`);
    execSyncMock.mockClear();
    await utils.cleanup();
    expect(execSyncMock).not.toHaveBeenCalled();
  });

  it('does nothing when the stack was never initialized or was already cleaned up', async () => {
    await new StackTestUtils().cleanup();
    const utils = new StackTestUtils();
    await started(utils);
    await utils.cleanup();
    execSyncMock.mockClear();
    await utils.cleanup();
    expect(execSyncMock).not.toHaveBeenCalled();
  });
});

describe('before initialize', () => {
  it('makeRequest throws', async () => {
    await expect(new StackTestUtils().makeRequest('GET', '/health')).rejects.toThrow('Stack not initialized');
  });

  it('getLogs throws', () => {
    expect(() => new StackTestUtils().getLogs('app')).toThrow('Stack not initialized');
  });
});
