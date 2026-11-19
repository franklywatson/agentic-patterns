import type { Grant, RepairPolicy } from './types';

const GRANT_ORDER: Grant[] = ['A1', 'A2', 'A3', 'A4', 'A5'];

export interface BreakerState {
  grant: Grant;
  attempts: Record<string, { count: number; lastAttemptAt: number; lastOutcome: string }>;
  confirmedAt: Record<string, number>;
  recurrences: number;
  cleanRepairsSinceTrip: number;
  stop: { by: string; at: number } | null;
  decisions: { at: number; kind: string; by: string; detail: string }[];
}

const DAY_MS = 86_400_000;

export const newBreaker = (grant: Grant): BreakerState => ({
  grant,
  attempts: {},
  confirmedAt: {},
  recurrences: 0,
  cleanRepairsSinceTrip: 0,
  stop: null,
  decisions: [],
});

const copy = (s: BreakerState): BreakerState => structuredClone(s);

/** Attempts used and whether the cooldown after the last failed attempt is still running. */
export function budgetFor(state: BreakerState, fingerprint: string, now: number, policy: RepairPolicy) {
  const entry = state.attempts[fingerprint];
  const cooldownActive =
    entry !== undefined &&
    entry.lastOutcome !== 'confirmed' &&
    now - entry.lastAttemptAt < policy.budget.cooldownSeconds * 1000;
  return {
    attemptsUsed: entry?.count ?? 0,
    attemptsAllowed: policy.budget.attemptsPerFingerprint,
    cooldownActive,
  };
}

export function recordAttempt(state: BreakerState, fingerprint: string, now: number, outcome: string): BreakerState {
  const next = copy(state);
  const entry = next.attempts[fingerprint] ?? { count: 0, lastAttemptAt: 0, lastOutcome: '' };
  next.attempts[fingerprint] = { count: entry.count + 1, lastAttemptAt: now, lastOutcome: outcome };
  return next;
}

export function recordConfirmed(state: BreakerState, fingerprint: string, now: number): BreakerState {
  const next = recordAttempt(state, fingerprint, now, 'confirmed');
  next.confirmedAt[fingerprint] = now;
  next.cleanRepairsSinceTrip += 1;
  return next;
}

/**
 * A fingerprint reappears. If it recurs inside the window after a confirmed repair, the
 * recurrence count rises and, at the trip threshold, the grant drops one level.
 */
export function recordRecurrence(state: BreakerState, fingerprint: string, now: number, policy: RepairPolicy): BreakerState {
  const confirmed = state.confirmedAt[fingerprint];
  if (confirmed === undefined || now - confirmed > policy.breaker.recurrenceWindowDays * DAY_MS) return state;
  const next = copy(state);
  next.recurrences += 1;
  next.cleanRepairsSinceTrip = 0;
  if (next.recurrences >= policy.breaker.tripRecurrences) {
    const lowered = GRANT_ORDER[Math.max(0, GRANT_ORDER.indexOf(next.grant) - 1)];
    next.decisions.push({ at: now, kind: 'grant-dropped', by: 'breaker', detail: `${next.grant} -> ${lowered} after recurrence of ${fingerprint}` });
    next.grant = lowered;
    next.recurrences = 0;
  }
  return next;
}

/**
 * Restoring a dropped grant is a named human decision. Hysteresis: it also needs a run of
 * clean confirmed repairs, a higher bar than the single recurrence that tripped the breaker.
 */
export function restoreGrant(state: BreakerState, to: Grant, by: string, now: number, policy: RepairPolicy): BreakerState {
  if (by.trim() === '' || /^(agent|bot|breaker)\b/i.test(by)) {
    throw new Error('restoring a grant requires a named human');
  }
  if (state.cleanRepairsSinceTrip < policy.breaker.resetCleanRepairs) {
    throw new Error(
      `restore needs ${policy.breaker.resetCleanRepairs} clean repairs, found ${state.cleanRepairsSinceTrip}`,
    );
  }
  const next = copy(state);
  next.decisions.push({ at: now, kind: 'grant-restored', by, detail: `${next.grant} -> ${to}` });
  next.grant = to;
  return next;
}

export function engageStop(state: BreakerState, by: string, now: number): BreakerState {
  if (by.trim() === '') throw new Error('the stop switch needs the name of the person who pulled it');
  const next = copy(state);
  next.stop = { by, at: now };
  next.decisions.push({ at: now, kind: 'stop-engaged', by, detail: 'stop switch engaged' });
  return next;
}

export function releaseStop(state: BreakerState, by: string, now: number): BreakerState {
  if (by.trim() === '' || /^(agent|bot|breaker)\b/i.test(by)) {
    throw new Error('releasing the stop requires a named human');
  }
  const next = copy(state);
  next.stop = null;
  next.decisions.push({ at: now, kind: 'stop-released', by, detail: 'stop switch released' });
  return next;
}
