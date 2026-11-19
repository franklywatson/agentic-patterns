import { newBreaker, recordAttempt } from '../../src/breaker';
import { evaluateConfirmation, runRepair, transition, type Deployment, type OutboxEntry, type RepairEnvironment } from '../../src/loop';
import { patchText, policy, rules } from '../support/builders';
import { parseIncident } from '../../src/incident';
import { loadIncidentRecord } from '../../src/config';

const incident = parseIncident(loadIncidentRecord('INC-001'));

/** A fake environment for unit tests. Mocks are appropriate here (Pattern 1.5). */
function fakeEnvironment(opts: { baseRed?: boolean; candidateGreen?: boolean; patch?: string; currentHash?: string; fingerprintCount?: number }) {
  const outbox: OutboxEntry[] = [];
  const events: string[] = [];
  const deployed: string[] = [];
  const deployment = (name: string): Deployment => ({ baseUrl: name, logs: () => '', stop: () => { deployed.push(`stop:${name}`); } });
  const env: RepairEnvironment = {
    now: () => 1_000_000,
    freeze: async () => ({ dir: 'base' }),
    candidate: async () => ({ handle: { dir: 'candidate' }, patchText: opts.patch ?? patchText('INC-001.fix.patch') }),
    deploy: async (h) => { deployed.push(`start:${h.dir}`); return deployment(h.dir); },
    runReproduction: async (h) => (h.dir === 'base' ? !(opts.baseRed ?? true) : opts.candidateGreen ?? true),
    runRegression: async () => true,
    frozenHash: () => 'frozen',
    currentHash: () => opts.currentHash ?? 'frozen',
    traffic: async (_d, _i, samples) => ({ samples, fingerprintCount: opts.fingerprintCount ?? 0 }),
    emit: (_h, entry) => { outbox.push(entry); },
    record: (_h, entry) => { events.push(entry.event); },
  };
  return { env, outbox, events, deployed };
}

const input = (breaker = newBreaker('A3'), patchFile = 'fix.patch') => ({ incident, patchFile, breaker, policy, rules });

describe('transition', () => {
  test('follows the table', () => {
    expect(transition('IDLE', 'incident')).toBe('DETECTED');
    expect(transition('CANDIDATE', 'gate_block')).toBe('BLOCKED');
    expect(transition('PR_OPENED', 'confirm_fail')).toBe('ROLLED_BACK');
  });

  test('rejects moves the table does not contain', () => {
    expect(() => transition('IDLE', 'gate_auto')).toThrow('invalid transition: IDLE on gate_auto');
    expect(() => transition('CONFIRMED', 'incident')).toThrow('invalid transition');
  });

  test('the stop event is valid from every working state and terminal states accept nothing', () => {
    for (const state of ['IDLE', 'DETECTED', 'REPRODUCED', 'CANDIDATE', 'GATED', 'PR_OPENED'] as const) {
      expect(transition(state, 'stop')).toBe('STOPPED');
    }
    expect(() => transition('HUMAN', 'stop')).toThrow('invalid transition');
  });
});

describe('evaluateConfirmation', () => {
  test('needs the minimum sample and no fingerprint hits', () => {
    expect(evaluateConfirmation({ samples: 50, fingerprintCount: 0 }, policy.confirm)).toBe('confirmed');
    expect(evaluateConfirmation({ samples: 49, fingerprintCount: 0 }, policy.confirm)).toBe('insufficient-sample');
    expect(evaluateConfirmation({ samples: 500, fingerprintCount: 1 }, policy.confirm)).toBe('fingerprint-present');
  });
});

describe('runRepair with a fake environment', () => {
  test('a clean fix is confirmed and both stacks are stopped', async () => {
    const { env, outbox, deployed } = fakeEnvironment({});
    const outcome = await runRepair(env, input());
    expect(outcome.state).toBe('CONFIRMED');
    expect(outbox.map((e) => e.kind)).toEqual(['pr']);
    expect(deployed).toEqual(['start:base', 'stop:base', 'start:candidate', 'stop:candidate']);
    expect(outcome.breaker.confirmedAt[incident.fingerprint]).toBe(1_000_000);
  });

  test('a reproduction that is not red routes to a human before any candidate is built', async () => {
    const { env, outbox, deployed } = fakeEnvironment({ baseRed: false });
    const outcome = await runRepair(env, input());
    expect(outcome.state).toBe('HUMAN');
    expect(outcome.reasons).toEqual(['cannot reproduce']);
    expect(outbox[0].title).toContain('cannot reproduce');
    expect(deployed).toEqual(['start:base', 'stop:base']);
  });

  test('a changed reproduction hash is blocked', async () => {
    const { env, outbox } = fakeEnvironment({ currentHash: 'edited' });
    const outcome = await runRepair(env, input());
    expect(outcome.state).toBe('BLOCKED');
    expect(outbox.map((e) => e.kind)).toEqual(['page']);
  });

  test('a failed confirmation rolls back and pages the owner', async () => {
    const { env, outbox } = fakeEnvironment({ fingerprintCount: 2 });
    const outcome = await runRepair(env, input());
    expect(outcome.state).toBe('ROLLED_BACK');
    expect(outbox.map((e) => e.kind)).toEqual(['pr', 'page']);
    expect(outcome.breaker.attempts[incident.fingerprint].lastOutcome).toBe('rolled-back');
  });

  test('a spent budget is refused before any stack starts', async () => {
    const { env, deployed } = fakeEnvironment({});
    const spent = recordAttempt(newBreaker('A3'), incident.fingerprint, 900_000, 'rolled-back');
    const outcome = await runRepair(env, input(spent));
    expect(outcome.state).toBe('HUMAN');
    expect(deployed).toEqual([]);
  });

  test('an engaged stop returns STOPPED without touching the environment', async () => {
    const { env, deployed, events } = fakeEnvironment({});
    const stopped = { ...newBreaker('A3'), stop: { by: 'oncall-alice', at: 1 } };
    const outcome = await runRepair(env, input(stopped));
    expect(outcome.state).toBe('STOPPED');
    expect(deployed).toEqual([]);
    expect(events).toEqual([]);
  });

  test('the gate sees a bundle built from observations, not from the candidate', async () => {
    const { env } = fakeEnvironment({});
    const outcome = await runRepair(env, input());
    expect(outcome.bundle).toEqual(expect.objectContaining({ regression: 'pass', grant: 'A3' }));
    expect(outcome.bundle?.reproduction).toEqual({ redOnBase: true, greenOnCandidate: true, frozenSha256: 'frozen', currentSha256: 'frozen' });
  });
});
