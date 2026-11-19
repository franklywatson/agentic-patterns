/**
 * 04-repair-test-edit-blocked.stack.test.ts
 *
 * Journey: a candidate edits the reproduction test so that it passes against the unfixed
 * app. The frozen hash no longer matches, so the gate returns block.
 */
import { cleanup, incident, outboxOf, repairWith } from './support';

describe('Stack Test 04: editing the reproduction is blocked', () => {
  let result: Awaited<ReturnType<typeof repairWith>>;

  beforeAll(async () => {
    result = await repairWith('INC-001.test-edit.patch');
  }, 900000);

  afterAll(() => cleanup(result?.outcome));

  test('primary: the gate returns block', () => {
    expect(result.outcome.gate?.decision).toBe('block');
    expect(result.outcome.state).toBe('BLOCKED');
  });

  test('second order: the edited test is green although the bug is still in the app', () => {
    const [onBase, onCandidate] = result.env.runs.filter((r) => r.kind === 'reproduction');
    expect(onBase.passed).toBe(false);
    expect(onCandidate.passed).toBe(true);
    expect(result.outcome.bundle?.diff.map((f) => f.path)).toEqual(['tests/repro/INC-001.repro.test.ts']);
  });

  test('second order: the hash changed, and class and scan alone would have allowed it', () => {
    const bundle = result.outcome.bundle!;
    expect(bundle.reproduction.frozenSha256).not.toBe(bundle.reproduction.currentSha256);
    expect(bundle.classification).toMatchObject({ reversibility: 'R0', blast: 'B0' });
    expect(bundle.antimask).toEqual([]);
    expect(result.outcome.gate?.reasons.join('\n')).toContain('reproduction test changed after it was frozen');
    expect(result.outcome.gate?.reasons.join('\n')).toContain('protected path tests/repro/INC-001.repro.test.ts');
  });

  test('third order: a page reaches the owner and no pull request is opened', () => {
    const outbox = outboxOf(result.outcome);
    expect(outbox.map((e) => e.kind)).toEqual(['page']);
    expect(outbox[0].incidentId).toBe(incident().id);
    expect(result.outcome.breaker.attempts[incident().fingerprint]).toMatchObject({ count: 1, lastOutcome: 'blocked' });
  });
});
