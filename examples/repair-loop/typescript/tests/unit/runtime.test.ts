import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPatch, observedDiff, validatePatch } from '../../src/runtime';
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

  test('rejects an empty patch', () => {
    expect(() => validatePatch('not a patch')).toThrow('no files');
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
