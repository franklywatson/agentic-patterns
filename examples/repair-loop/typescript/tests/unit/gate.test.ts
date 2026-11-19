import { gate, mergeFor } from '../../src/gate';
import type { EvidenceBundle } from '../../src/types';
import { bundleFromDiff, cleanBundle, makeDiff, patchText, policy } from '../support/builders';

const decide = (overrides: Partial<EvidenceBundle> = {}) => gate(cleanBundle(overrides), policy);

describe('gate', () => {
  test('clean evidence within the ceiling returns auto', () => {
    expect(decide()).toEqual({ decision: 'auto', reasons: ['all mechanical checks passed within the ceiling'], merge: 'person' });
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
    expect(decide({ grant: 'A2' }).reasons).toContain('grant A2 is below A3');
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

  test('below A4 a person merges every auto change', () => {
    expect(decide({ grant: 'A3' }).merge).toBe('person');
    expect(gate(bundleFromDiff(makeDiff('docs/notes.md', ['text'])), policy).merge).toBe('person');
  });

  test('at A4 only R0 and R1 at B0 merge unattended; an R2 fix is merged by a person', () => {
    expect(gate(bundleFromDiff(makeDiff('docs/notes.md', ['text']), { grant: 'A4' }), policy).merge).toBe('unattended');
    expect(decide({ grant: 'A4' })).toMatchObject({ decision: 'auto', merge: 'person' });
  });

  test('at A5 an R2 change merges unattended only at B0 and only when every file is on a named path', () => {
    expect(decide({ grant: 'A5' }).merge).toBe('unattended');
    expect(gate(bundleFromDiff(makeDiff('app/src/health.ts', ['const ok = true;']), { grant: 'A5' }), policy).merge).toBe('person');
    const mixed = makeDiff('app/src/routes/users.ts', ['const ok = true;']) + makeDiff('docs/notes.md', ['text']);
    expect(gate(bundleFromDiff(mixed, { grant: 'A5' }), policy).merge).toBe('person');
  });

  test('human and block decisions carry no merge', () => {
    expect(decide({ grant: 'A2' }).merge).toBeNull();
    expect(decide({ grant: 'A5', regression: 'fail' }).merge).toBeNull();
  });

  test('R3 and R4 never merge unattended, even under a policy that names a higher ceiling', () => {
    const loose = {
      ...policy,
      autoCeiling: { reversibility: 'R4', blast: 'B3' } as const,
      unattendedCeiling: { A5: { reversibility: 'R4', blast: 'B3' } as const },
    };
    const schema = bundleFromDiff(makeDiff('app/src/routes/users.ts', ['await pool.query("ALTER TABLE users ADD COLUMN x INT");']), { grant: 'A5' });
    expect(gate(schema, loose)).toMatchObject({ decision: 'auto', merge: 'person' });
  });

  test('instruction and tool-configuration files are medium tier: a person merges them at every grant', () => {
    const paths = ['CLAUDE.md', 'AGENTS.md', 'app/CLAUDE.md', 'docs/AGENTS.md', '.claude/CLAUDE.md', '.claude/rules/style.md',
      '.claude/agents/fixer.md', '.claude/commands/ship.md', '.claude/skills/review/SKILL.md', '.claude/skills/review/run.sh', '.mcp.json',
      'claude.md', 'Agents.md', '.Claude/Skills/x/SKILL.md'];
    for (const path of paths) {
      for (const grant of ['A4', 'A5'] as const) {
        const result = gate(bundleFromDiff(makeDiff(path, ['text']), { grant }), policy);
        expect([path, grant, result.decision, result.merge]).toEqual([path, grant, 'auto', 'person']);
        expect([path, bundleFromDiff(makeDiff(path, ['text'])).classification.blast]).toEqual([path, 'B1']);
      }
    }
  });

  test('a protected path in another case still blocks', () => {
    for (const path of ['Tests/unit/x.test.ts', 'TESTS/x.py', 'Shared/Config/repair-policy.json', '.Autonomy.yaml', '.GitHub/workflows/ci.yml']) {
      const result = gate(bundleFromDiff(makeDiff(path, ['x'])), policy);
      expect([path, result.decision]).toEqual([path, 'block']);
      expect(result.reasons.join('\n')).toContain('protected path');
    }
  });

  test('a person merges below A4 even when the policy names an unattended ceiling for the grant', () => {
    const loose = { ...policy, unattendedCeiling: { ...policy.unattendedCeiling, A3: { reversibility: 'R1', blast: 'B0' } as const } };
    expect(gate(bundleFromDiff(makeDiff('docs/notes.md', ['text']), { grant: 'A3' }), loose).merge).toBe('person');
    expect(gate(bundleFromDiff(makeDiff('docs/notes.md', ['text']), { grant: 'A4' }), loose).merge).toBe('unattended');
  });

  test('mergeFor keeps a person on an R2 change with an empty diff or an unsafe path, even at A5', () => {
    const named = bundleFromDiff(makeDiff('app/src/routes/users.ts', ['const ok = true;']), { grant: 'A5' });
    expect(mergeFor(named, policy)).toBe('unattended');
    expect(mergeFor({ ...named, diff: [] }, policy)).toBe('person');
    expect(mergeFor({ ...named, diff: [{ ...named.diff[0], path: 'app/src/routes/../routes/users.ts' }] }, policy)).toBe('person');
  });

  test('the gate does not mutate its inputs', () => {
    const bundle = cleanBundle();
    const before = JSON.stringify(bundle);
    gate(bundle, policy);
    expect(JSON.stringify(bundle)).toBe(before);
  });
});
