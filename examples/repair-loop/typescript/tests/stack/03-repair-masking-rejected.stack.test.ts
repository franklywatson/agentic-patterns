/**
 * 03-repair-masking-rejected.stack.test.ts
 *
 * Journey: a candidate makes the reproduction green by swallowing every error. The
 * anti-masking scan reclassifies it as a mitigation; the gate returns human and a
 * root-cause ticket lands in the outbox.
 */
import { cleanup, incident, outboxOf, registerEventsOf, repairWith } from './support';

describe('Stack Test 03: a masking change is routed to a human', () => {
  let result: Awaited<ReturnType<typeof repairWith>>;

  beforeAll(async () => {
    result = await repairWith('INC-001.mask.patch');
  }, 900000);

  afterAll(() => cleanup(result?.outcome));

  test('primary: the gate returns human, not auto', () => {
    expect(result.outcome.gate?.decision).toBe('human');
    expect(result.outcome.state).toBe('HUMAN');
  });

  test('second order: the mask satisfies the oracle, so only the scan can catch it', () => {
    const bundle = result.outcome.bundle!;
    expect(bundle.reproduction.redOnBase).toBe(true);
    expect(bundle.reproduction.greenOnCandidate).toBe(true);
    expect(bundle.regression).toBe('pass');
    expect(bundle.reproduction.frozenSha256).toBe(bundle.reproduction.currentSha256);
    expect(bundle.antimask.map((h) => h.rule)).toContain('swallowed-exception');
    expect(bundle.antimask[0].file).toBe('app/src/routes/users.ts');
  });

  test('second order: the gate names the scan as the reason', () => {
    expect(result.outcome.gate?.reasons.join(' ')).toContain('anti-masking scan');
  });

  test('third order: a root-cause ticket is in the outbox, no pull request is', () => {
    const outbox = outboxOf(result.outcome);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].kind).toBe('ticket');
    expect(outbox[0].incidentId).toBe(incident().id);
    expect(outbox[0].title).toContain('root-cause ticket');
    expect(outbox[0].owner).toBe(result.policy.owner);
    expect(outbox[0].detail.join('\n')).toContain('swallowed-exception');
  });

  test('third order: the register stops at the human decision and the budget is spent', () => {
    expect(registerEventsOf(result.outcome)).toEqual(['incident', 'reproduced', 'candidate_ready', 'gate_human']);
    expect(result.outcome.breaker.attempts[incident().fingerprint]).toMatchObject({ count: 1, lastOutcome: 'human' });
  });
});
