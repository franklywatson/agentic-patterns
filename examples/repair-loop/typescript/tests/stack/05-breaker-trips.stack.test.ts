/**
 * 05-breaker-trips.stack.test.ts
 *
 * Journey: a repair is confirmed, then the same fingerprint reappears in the logs of a
 * regressed build. The breaker drops the grant, the next attempt goes to a person, and
 * the stop switch halts the loop before any stack starts.
 */
import { engageStop, restoreGrant } from '../../src/breaker';
import { gate } from '../../src/gate';
import { fingerprintsFromLog } from '../../src/incident';
import { observeRecurrence, runRepair } from '../../src/loop';
import { loadRules } from '../../src/config';
import axios from 'axios';
import { cleanup, incident, outboxOf, patchPath, repairWith } from './support';

describe('Stack Test 05: the breaker trips on a recurrence', () => {
  let first: Awaited<ReturnType<typeof repairWith>>;
  let afterRecurrence: ReturnType<typeof observeRecurrence>;
  let regressedFingerprints: string[];

  beforeAll(async () => {
    first = await repairWith('INC-001.fix.patch');
    // The regressed build is the base workspace: it still contains the defect.
    const regressed = await first.env.deploy(first.outcome.base!);
    try {
      await axios.get(`${regressed.baseUrl}${incident().request.path}`, { validateStatus: () => true });
      regressedFingerprints = fingerprintsFromLog(regressed.logs());
      afterRecurrence = observeRecurrence(first.outcome.breaker, incident(), regressed.logs(), first.env.now() + 3600_000, first.policy);
    } finally {
      regressed.stop();
    }
  }, 900000);

  afterAll(() => cleanup(first?.outcome));

  test('the regressed build logs the fingerprint of the repaired incident', () => {
    expect(regressedFingerprints).toContain(incident().fingerprint);
  });

  test('primary: the first repair was confirmed, then the recurrence dropped the grant', () => {
    expect(first.outcome.state).toBe('CONFIRMED');
    expect(first.outcome.breaker.grant).toBe('A3');
    expect(afterRecurrence.grant).toBe('A2');
    expect(afterRecurrence.decisions.map((d) => d.kind)).toEqual(['grant-dropped']);
  });

  test('second order: the same clean evidence now gets human, because the grant is below A3', () => {
    const decision = gate({ ...first.outcome.bundle!, grant: afterRecurrence.grant }, first.policy);
    expect(decision.decision).toBe('human');
    expect(decision.reasons.join('\n')).toContain('grant A2 is below A3');
  });

  test('second order: a new attempt on the fingerprint is refused before any stack starts', async () => {
    const { createEnvironment } = await import('../../src/runtime');
    const env = createEnvironment();
    const refused = await runRepair(env, {
      incident: incident(),
      patchFile: patchPath('INC-001.fix.patch'),
      breaker: afterRecurrence,
      policy: first.policy,
      rules: loadRules(),
    });
    try {
      expect(refused.state).toBe('HUMAN');
      expect(refused.reasons).toEqual(['attempt budget exhausted or cooldown active']);
      expect(env.runs).toEqual([]);
      expect(outboxOf(refused).map((e) => e.kind)).toEqual(['page']);
    } finally {
      cleanup(refused);
    }
  });

  test('third order: the stop switch halts the loop before any stack starts', async () => {
    const { createEnvironment } = await import('../../src/runtime');
    const env = createEnvironment();
    const stopped = engageStop(afterRecurrence, 'oncall-alice', env.now());
    const outcome = await runRepair(env, {
      incident: incident(),
      patchFile: patchPath('INC-001.fix.patch'),
      breaker: stopped,
      policy: first.policy,
      rules: loadRules(),
    });
    expect(outcome.state).toBe('STOPPED');
    expect(outcome.reasons).toEqual(['stopped by oncall-alice']);
    expect(env.runs).toEqual([]);
    expect(gate({ ...first.outcome.bundle!, stopEngaged: true }, first.policy).decision).toBe('block');
  });

  test('third order: restoring the grant needs a named human and a run of clean repairs', () => {
    expect(() => restoreGrant(afterRecurrence, 'A3', 'agent:repair-bot', Date.now(), first.policy)).toThrow('named human');
    expect(() => restoreGrant(afterRecurrence, 'A3', 'alice', Date.now(), first.policy)).toThrow('needs 5 clean repairs');
  });
});
