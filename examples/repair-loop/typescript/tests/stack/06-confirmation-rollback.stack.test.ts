/**
 * 06-confirmation-rollback.stack.test.ts
 *
 * Journey: an over-fitted fix guards only the literal id from the incident. It passes the
 * reproduction and the regression suite, so the gate returns auto. The confirmation window
 * replays the incident's traffic, still sees the fingerprint, and rolls the repair back.
 */
import { cleanup, incident, outboxOf, registerEventsOf, repairWith } from './support';

describe('Stack Test 06: a failed confirmation rolls the repair back', () => {
  let result: Awaited<ReturnType<typeof repairWith>>;

  beforeAll(async () => {
    result = await repairWith('INC-001.partial.patch');
  }, 900000);

  afterAll(() => cleanup(result?.outcome));

  test('primary: the gate said auto, and confirmation then rolled the repair back', () => {
    expect(result.outcome.gate?.decision).toBe('auto');
    expect(result.outcome.state).toBe('ROLLED_BACK');
    expect(result.outcome.reasons).toEqual(['fingerprint-present']);
  });

  test('second order: the oracle was satisfied, so only the confirmation window could catch it', () => {
    const bundle = result.outcome.bundle!;
    expect(bundle.reproduction.greenOnCandidate).toBe(true);
    expect(bundle.regression).toBe('pass');
    expect(bundle.antimask).toEqual([]);
  });

  test('third order: a pull request and then a page are in the outbox, and the budget is spent', () => {
    expect(outboxOf(result.outcome).map((e) => e.kind)).toEqual(['pr', 'page']);
    expect(registerEventsOf(result.outcome).slice(-2)).toEqual(['gate_auto', 'confirm_fail']);
    expect(result.outcome.breaker.attempts[incident().fingerprint]).toMatchObject({ count: 1, lastOutcome: 'rolled-back' });
    expect(result.outcome.breaker.confirmedAt[incident().fingerprint]).toBeUndefined();
  });
});
