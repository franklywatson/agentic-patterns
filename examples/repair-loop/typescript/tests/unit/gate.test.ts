import { gate } from '../../src/gate';
import type { EvidenceBundle } from '../../src/types';
import { bundleFromDiff, cleanBundle, makeDiff, patchText, policy } from '../support/builders';

const decide = (overrides: Partial<EvidenceBundle> = {}) => gate(cleanBundle(overrides), policy);

describe('gate', () => {
  test('clean evidence within the ceiling returns auto', () => {
    expect(decide()).toEqual({ decision: 'auto', reasons: ['all mechanical checks passed within the ceiling'] });
  });

  test('a changed reproduction hash blocks', () => {
    const result = decide({ reproduction: { redOnBase: true, greenOnCandidate: true, frozenSha256: 'a', currentSha256: 'b' } });
    expect(result.decision).toBe('block');
    expect(result.reasons).toContain('reproduction test changed after it was frozen');
  });

  test('any change under tests/ blocks: modified, added or deleted', () => {
    for (const status of ['modified', 'added'] as const) {
      const result = gate(bundleFromDiff(makeDiff('tests/unit/other.test.ts', ['x'], ['y'], status)), policy);
      expect(result.decision).toBe('block');
      expect(result.reasons).toContain('diff touches protected path tests/unit/other.test.ts');
    }
    const deleted = bundleFromDiff(makeDiff('tests/unit/other.test.ts', [], ['y']));
    expect(gate({ ...deleted, diff: [{ ...deleted.diff[0], status: 'deleted' }] }, policy).decision).toBe('block');
  });

  test('a conftest-style file or a shadowing module added under tests/ blocks', () => {
    for (const path of ['tests/conftest.py', 'tests/__mocks__/axios.ts', 'tests/repro/node_modules/axios/index.js']) {
      expect(gate(bundleFromDiff(makeDiff(path, ['x'], [], 'added')), policy).decision).toBe('block');
    }
  });

  test('a path with .. segments blocks, whatever it resolves to', () => {
    for (const path of ['app/src/routes/../auth.ts', 'tests/../app/src/routes/evil.ts', '/etc/passwd', '../escape.ts']) {
      const result = gate(bundleFromDiff(makeDiff(path, ['x'], [], 'added')), policy);
      expect(result.decision).toBe('block');
      expect(result.reasons.join('\n')).toContain('unsafe path');
    }
  });

  test('the register file is protected whatever its status', () => {
    const result = gate(bundleFromDiff(makeDiff('.autonomy.yaml', ['grant: A5'], [], 'added')), policy);
    expect(result.decision).toBe('block');
  });

  test('a candidate that leaves the reproduction red is blocked', () => {
    expect(decide({ reproduction: { redOnBase: true, greenOnCandidate: false, frozenSha256: 'a', currentSha256: 'a' } }).decision).toBe('block');
  });

  test('a failing regression suite blocks', () => {
    expect(decide({ regression: 'fail' }).decision).toBe('block');
  });

  test('an engaged stop switch blocks even clean evidence', () => {
    expect(decide({ stopEngaged: true }).decision).toBe('block');
  });

  test('a reproduction that was not red on base routes to a human', () => {
    const result = decide({ reproduction: { redOnBase: false, greenOnCandidate: true, frozenSha256: 'a', currentSha256: 'a' } });
    expect(result.decision).toBe('human');
    expect(result.reasons[0]).toContain('cannot reproduce');
  });

  test('the masking patch routes to a human', () => {
    const result = gate(bundleFromDiff(patchText('INC-001.mask.patch')), policy);
    expect(result.decision).toBe('human');
    expect(result.reasons[0]).toContain('anti-masking scan');
  });

  test('a class above the ceiling routes to a human', () => {
    const result = gate(bundleFromDiff(makeDiff('app/src/auth.ts', ['const a = 1;'])), policy);
    expect(result.decision).toBe('human');
    expect(result.reasons[0]).toContain('R2/B3 is above the ceiling R2/B1');
  });

  test('a grant below A3 routes to a human', () => {
    expect(decide({ grant: 'A2' }).decision).toBe('human');
  });

  test('a spent budget and an active cooldown each route to a human', () => {
    expect(decide({ budget: { attemptsUsed: 1, attemptsAllowed: 1, cooldownActive: false } }).decision).toBe('human');
    expect(decide({ budget: { attemptsUsed: 0, attemptsAllowed: 1, cooldownActive: true } }).decision).toBe('human');
  });

  test('block outranks human: the most severe decision wins and only its reasons are listed', () => {
    const result = decide({ grant: 'A1', regression: 'fail' });
    expect(result.decision).toBe('block');
    expect(result.reasons).toEqual(['regression suite is not green on the candidate']);
  });

  test('the gate does not mutate its inputs', () => {
    const bundle = cleanBundle();
    const before = JSON.stringify(bundle);
    gate(bundle, policy);
    expect(JSON.stringify(bundle)).toBe(before);
  });
});
