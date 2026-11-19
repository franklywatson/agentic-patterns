/**
 * 02-repair-INC-001.stack.test.ts
 *
 * Journey: an incident arrives, the loop reproduces it, applies the real fix, verifies it,
 * and the gate returns auto. Real Docker stacks with PostgreSQL and Redis; the reproduction
 * and the regression suite run against the deployed app over HTTP.
 */
import { join } from 'node:path';
import { readFileSync } from 'node:fs';
import { sha256File } from '../../src/reproduce';
import { cleanup, incident, outboxOf, registerEventsOf, repairWith } from './support';

describe('Stack Test 02: repair INC-001 with the real fix', () => {
  let result: Awaited<ReturnType<typeof repairWith>>;

  beforeAll(async () => {
    result = await repairWith('INC-001.fix.patch');
  }, 900000);

  afterAll(() => cleanup(result?.outcome));

  test('primary: the gate returns auto and the loop confirms the repair', () => {
    expect(result.outcome.gate?.decision).toBe('auto');
    expect(result.outcome.state).toBe('CONFIRMED');
  });

  test('second order: the reproduction was red for the right reason, then green', () => {
    const reproductionRuns = result.env.runs.filter((r) => r.kind === 'reproduction');
    expect(reproductionRuns).toHaveLength(2);
    const [onBase, onCandidate] = reproductionRuns;
    expect(onBase.passed).toBe(false);
    expect(onBase.output).toContain('Expected: 404');
    expect(onBase.output).toContain('Received: 500');
    expect(onCandidate.passed).toBe(true);
    expect(result.outcome.bundle?.reproduction.redOnBase).toBe(true);
    expect(result.outcome.bundle?.reproduction.greenOnCandidate).toBe(true);
  });

  test('second order: the regression suite is green and the diff is clean and small', () => {
    expect(result.outcome.bundle?.regression).toBe('pass');
    expect(result.outcome.bundle?.antimask).toEqual([]);
    expect(result.outcome.bundle?.classification).toMatchObject({ reversibility: 'R2', blast: 'B0' });
    expect(result.outcome.bundle?.diff.map((f) => f.path)).toEqual(['app/src/routes/users.ts']);
  });

  test('second order: the frozen hash on disk matches the reproduction that ran', () => {
    const base = result.outcome.base!;
    const lock = JSON.parse(readFileSync(join(base.dir, '.repair', 'INC-001.lock.json'), 'utf-8'));
    const candidateHash = sha256File(join(`${base.dir}-candidate`, lock.path));
    expect(candidateHash).toBe(lock.sha256);
    expect(result.outcome.bundle?.reproduction.frozenSha256).toBe(lock.sha256);
  });

  test('third order: the outbox holds one pull request and the register holds the full path', () => {
    const outbox = outboxOf(result.outcome);
    expect(outbox.map((e) => e.kind)).toEqual(['pr']);
    expect(outbox[0].incidentId).toBe(incident().id);
    expect(registerEventsOf(result.outcome)).toEqual([
      'incident', 'reproduced', 'candidate_ready', 'gate_auto', 'gate_auto', 'confirm_pass',
    ]);
    expect(result.outcome.breaker.confirmedAt[incident().fingerprint]).toBeGreaterThan(0);
  });
});
