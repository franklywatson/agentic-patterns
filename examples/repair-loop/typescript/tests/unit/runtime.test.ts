import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPatch, createEnvironment, newWorkspace, observedDiff, removeWorkspaces, validatePatch } from '../../src/runtime';
import { parseDiff } from '../../src/diff';
import { makeDiff, patchText } from '../support/builders';

const sandbox = () => {
  const root = mkdtempSync(join(tmpdir(), 'repair-runtime-'));
  const base = join(root, 'base');
  const candidate = join(root, 'candidate');
  mkdirSync(join(base, 'app', 'src'), { recursive: true });
  writeFileSync(join(base, 'app', 'src', 'a.ts'), 'one\n');
  return { root, base: { dir: base }, candidate: { dir: candidate } };
};

describe('validatePatch', () => {
  test('accepts the three shipped patches', () => {
    for (const name of ['INC-001.fix.patch', 'INC-001.mask.patch', 'INC-001.test-edit.patch']) {
      expect(() => validatePatch(patchText(name))).not.toThrow();
    }
  });

  test.each(['../escaped.txt', 'app/../../escaped.txt', '/tmp/escaped.txt', 'app\\evil.txt'])('rejects %s', (path) => {
    expect(() => validatePatch(makeDiff(path, ['x'], [], 'added'))).toThrow('unsafe path');
  });

  test('rejects a text that is not a patch', () => {
    expect(() => validatePatch('not a patch')).toThrow('not a plain unified diff');
    expect(() => validatePatch('')).toThrow('no files');
  });

  const safe = ['--- a/app/src/a.ts', '+++ b/app/src/a.ts', '@@ -1,1 +1,1 @@', '-one', '+two'];

  test.each([
    ['context-diff header', [...safe, '*** a/../victim.txt', '--- b/app/nonexist.txt', '***************', '*** 1 ****', '--- 1 ----', '! PWN', '']],
    ['Index line', ['Index: ../victim.txt', ...safe, '']],
    ['diff --git header', ['diff --git a/app/src/a.ts b/../x', ...safe, '']],
    ['rename', [...safe, 'rename from app/src/a.ts', 'rename to ../x', '']],
    ['copy', [...safe, 'copy from app/src/a.ts', 'copy to ../x', '']],
    ['symlink mode', ['--- /dev/null', '+++ b/app/link', 'new file mode 120000', '@@ -0,0 +1,1 @@', '+../../etc/passwd', '']],
    ['mode line', ['old mode 100644', 'new mode 100755', ...safe, '']],
    ['binary patch', ['GIT binary patch', 'literal 3', 'xcmZ', '']],
    ['trailing garbage', [...safe, 'something else', '']],
    ['truncated hunk', ['--- a/app/src/a.ts', '+++ b/app/src/a.ts', '@@ -1,3 +1,3 @@', '-one', '']],
  ])('rejects %s', (_name, lines) => {
    expect(() => validatePatch(lines.join('\n'))).toThrow();
  });

  test('a hunk body that looks like headers is content, not a header (no false positive)', () => {
    const lines = ['--- a/app/src/a.ts', '+++ b/app/src/a.ts', '@@ -1,1 +1,3 @@', ' one', '++++ ../x', '+--- a/../y', ''];
    expect(() => validatePatch(lines.join('\n'))).not.toThrow();
  });
});

describe('applyPatch refuses what validation or git apply refuses', () => {
  test('a unified section plus a context-diff section naming ../victim.txt writes nothing outside', () => {
    const { root, base } = sandbox();
    const victim = join(root, 'victim.txt');
    writeFileSync(victim, 'safe\n');
    const patchFile = join(root, 'mixed.patch');
    writeFileSync(patchFile, ['--- a/app/src/a.ts', '+++ b/app/src/a.ts', '@@ -1,1 +1,1 @@', '-one', '+two', '*** a/../victim.txt', '--- b/app/nonexist.txt', '***************', '*** 1 ****', '--- 1 ----', '! PWN', ''].join('\n'));
    expect(() => applyPatch(base, patchFile)).toThrow('not a plain unified diff');
    expect(readFileSync(victim, 'utf-8')).toBe('safe\n');
    expect(readFileSync(join(base.dir, 'app/src/a.ts'), 'utf-8')).toBe('one\n');
  });

  test('content lines that start with +++ and contain .. apply as content', () => {
    const { root, base } = sandbox();
    const patchFile = join(root, 'content.patch');
    writeFileSync(patchFile, ['--- a/app/src/a.ts', '+++ b/app/src/a.ts', '@@ -1,1 +1,2 @@', ' one', '++++ ../x', ''].join('\n'));
    applyPatch(base, patchFile);
    expect(readFileSync(join(base.dir, 'app/src/a.ts'), 'utf-8')).toBe('one\n+++ ../x\n');
    expect(existsSync(join(base.dir, '.git'))).toBe(false);
  });
});

describe('createEnvironment().candidate returns the observed diff', () => {
  test('a file under dist/ that ships in the image is visible to the gate', async () => {
    const env = createEnvironment();
    const base = newWorkspace('observed');
    const root = mkdtempSync(join(tmpdir(), 'repair-observed-'));
    const patchFile = join(root, 'hidden.patch');
    writeFileSync(patchFile, ['--- /dev/null', '+++ b/app/src/dist/mask.ts', '@@ -0,0 +1,1 @@', '+export const mask = true;', ''].join('\n'));
    try {
      const { patchText } = await env.candidate(base, patchFile);
      const files = parseDiff(patchText);
      expect(files.map((f) => f.path)).toEqual(['app/src/dist/mask.ts']);
      expect(files[0].status).toBe('added');
      expect(patchText).toContain('diff -ruN');
    } finally {
      removeWorkspaces(base);
    }
  });

  test('a change under .repair is visible too', async () => {
    const env = createEnvironment();
    const base = newWorkspace('observed-repair');
    writeFileSync(join(base.dir, '.repair', 'x.json'), '{}\n');
    const root = mkdtempSync(join(tmpdir(), 'repair-observed-'));
    const patchFile = join(root, 'repair.patch');
    writeFileSync(patchFile, ['--- a/.repair/x.json', '+++ b/.repair/x.json', '@@ -1,1 +1,1 @@', '-{}', '+{"a":1}', ''].join('\n'));
    try {
      const { patchText } = await env.candidate(base, patchFile);
      expect(parseDiff(patchText).map((f) => f.path)).toEqual(['.repair/x.json']);
    } finally {
      removeWorkspaces(base);
    }
  });
});

describe('applyPatch and observedDiff (real patch and diff tools)', () => {
  test('a patch with a .. path is refused before patch runs and nothing is written outside the workspace', () => {
    const { root, base } = sandbox();
    const patchFile = join(root, 'evil.patch');
    writeFileSync(patchFile, makeDiff('../escaped.txt', ['pwned'], [], 'added'));
    expect(() => applyPatch(base, patchFile)).toThrow('unsafe path');
    expect(existsSync(join(root, 'escaped.txt'))).toBe(false);
    expect(existsSync(join(root, '..', 'escaped.txt'))).toBe(false);
  });

  test('the gate sees the observed directory diff, which names the files that really changed', () => {
    const { root, base, candidate } = sandbox();
    require('node:fs').cpSync(base.dir, candidate.dir, { recursive: true });
    const patchFile = join(root, 'ok.patch');
    writeFileSync(patchFile, ['--- a/app/src/a.ts', '+++ b/app/src/a.ts', '@@ -1,1 +1,1 @@', '-one', '+two', ''].join('\n'));
    applyPatch(candidate, patchFile);
    expect(readFileSync(join(candidate.dir, 'app/src/a.ts'), 'utf-8')).toBe('two\n');
    const files = parseDiff(observedDiff(base, candidate));
    expect(files).toEqual([{ path: 'app/src/a.ts', status: 'modified', added: ['two'], removed: ['one'] }]);
  });
});
