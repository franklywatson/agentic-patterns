import { scanProductionDiff } from '../../src/antimask';
import { parseDiff } from '../../src/diff';
import { makeDiff, patchText } from '../support/builders';

const scan = (path: string, added: string[], removed: string[] = []) =>
  scanProductionDiff(parseDiff(makeDiff(path, added, removed)));

describe('scanProductionDiff', () => {
  test('the real fix is clean', () => {
    expect(scanProductionDiff(parseDiff(patchText('INC-001.fix.patch')))).toEqual([]);
  });

  test('the masking patch is caught as a swallowed exception', () => {
    const hits = scanProductionDiff(parseDiff(patchText('INC-001.mask.patch')));
    expect(hits.map((h) => h.rule)).toEqual(['swallowed-exception']);
    expect(hits[0].file).toBe('app/src/routes/users.ts');
  });

  test('a catch that rethrows is allowed', () => {
    expect(scan('app/src/a.ts', ['try {', '  run();', '} catch (error) {', '  log(error);', '  throw error;', '}'])).toEqual([]);
  });

  test('a promise catch with a default value is a swallowed exception', () => {
    expect(scan('app/src/a.ts', ['const rows = await load().catch(() => []);']).map((h) => h.rule)).toEqual(['swallowed-exception']);
  });

  test('a new retry loop is a hit', () => {
    expect(scan('app/src/a.ts', ['for (let retries = 0; retries < 3; retries++) {']).map((h) => h.rule)).toEqual(['new-retry']);
  });

  test('a widened timeout is a hit, a narrowed one is not', () => {
    expect(scan('app/src/a.ts', ['const timeoutMs = 30000;'], ['const timeoutMs = 3000;']).map((h) => h.rule)).toEqual(['widened-timeout']);
    expect(scan('app/src/a.ts', ['const timeoutMs = 1000;'], ['const timeoutMs = 3000;'])).toEqual([]);
  });

  test('a lowered threshold is a hit, a raised one is not', () => {
    expect(scan('app/src/a.ts', ['const minSamples = 50;'], ['const minSamples = 5;'])).toEqual([]);
    expect(scan('app/src/a.ts', ['const minSamples = 5;'], ['const minSamples = 50;']).map((h) => h.rule)).toEqual(['lowered-threshold']);
  });

  test('test files are not production code', () => {
    expect(scan('tests/unit/a.test.ts', ['} catch {'])).toEqual([]);
  });
});
