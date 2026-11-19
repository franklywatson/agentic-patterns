import { budgetFor, engageStop, newBreaker, recordAttempt, recordConfirmed, recordRecurrence, releaseStop, restoreGrant } from '../../src/breaker';
import { policy } from '../support/builders';

const FP = '92e2a8020bd5';
const DAY = 86_400_000;

describe('breaker', () => {
  test('one attempt per fingerprint exhausts the budget', () => {
    const state = newBreaker('A3');
    expect(budgetFor(state, FP, 0, policy)).toEqual({ attemptsUsed: 0, attemptsAllowed: 1, cooldownActive: false });
    const used = recordAttempt(state, FP, 1000, 'rolled-back');
    expect(budgetFor(used, FP, 2000, policy)).toEqual({ attemptsUsed: 1, attemptsAllowed: 1, cooldownActive: true });
    expect(budgetFor(used, FP, 1000 + 901_000, policy).cooldownActive).toBe(false);
  });

  test('a confirmed attempt starts no cooldown', () => {
    const confirmed = recordConfirmed(newBreaker('A3'), FP, 1000);
    expect(budgetFor(confirmed, FP, 2000, policy).cooldownActive).toBe(false);
  });

  test('a recurrence inside the window drops the grant one level', () => {
    const confirmed = recordConfirmed(newBreaker('A3'), FP, 0);
    const tripped = recordRecurrence(confirmed, FP, 3 * DAY, policy);
    expect(tripped.grant).toBe('A2');
    expect(tripped.decisions[0]).toMatchObject({ kind: 'grant-dropped', by: 'breaker' });
    expect(tripped.cleanRepairsSinceTrip).toBe(0);
  });

  test('a recurrence outside the window, or of an unconfirmed fingerprint, changes nothing', () => {
    const confirmed = recordConfirmed(newBreaker('A3'), FP, 0);
    expect(recordRecurrence(confirmed, FP, 15 * DAY, policy).grant).toBe('A3');
    expect(recordRecurrence(newBreaker('A3'), FP, 0, policy).grant).toBe('A3');
  });

  test('the grant never drops below A1', () => {
    const confirmed = recordConfirmed(newBreaker('A1'), FP, 0);
    expect(recordRecurrence(confirmed, FP, DAY, policy).grant).toBe('A1');
  });

  test('restore needs a named human and five clean repairs (hysteresis)', () => {
    let state = recordRecurrence(recordConfirmed(newBreaker('A3'), FP, 0), FP, DAY, policy);
    expect(() => restoreGrant(state, 'A3', 'agent:repair-bot', 0, policy)).toThrow('named human');
    expect(() => restoreGrant(state, 'A3', '', 0, policy)).toThrow('named human');
    expect(() => restoreGrant(state, 'A3', 'alice', 0, policy)).toThrow('needs 5 clean repairs, found 0');
    for (let i = 0; i < 5; i++) state = recordConfirmed(state, `fp-${i}`, DAY + i);
    const restored = restoreGrant(state, 'A3', 'alice', 2 * DAY, policy);
    expect(restored.grant).toBe('A3');
    expect(restored.decisions.at(-1)).toMatchObject({ kind: 'grant-restored', by: 'alice' });
  });

  test('the stop switch needs a name, and only a person releases it', () => {
    expect(() => engageStop(newBreaker('A3'), '', 0)).toThrow('name');
    const stopped = engageStop(newBreaker('A3'), 'oncall-alice', 5);
    expect(stopped.stop).toEqual({ by: 'oncall-alice', at: 5 });
    expect(() => releaseStop(stopped, 'agent:x', 6)).toThrow('named human');
    expect(releaseStop(stopped, 'oncall-alice', 6).stop).toBeNull();
  });

  test('state transitions return new objects', () => {
    const state = newBreaker('A3');
    recordAttempt(state, FP, 1, 'x');
    expect(state.attempts).toEqual({});
  });
});
