import { scanProductionDiff } from './antimask';
import { budgetFor, recordAttempt, recordConfirmed, recordRecurrence, type BreakerState } from './breaker';
import { classify } from './classify';
import type { ReversibilityRules } from './config';
import { parseDiff } from './diff';
import { gate } from './gate';
import { fingerprintsFromLog } from './incident';
import type { EvidenceBundle, GateResult, Incident, RepairPolicy } from './types';

export type LoopState =
  | 'IDLE' | 'DETECTED' | 'REPRODUCED' | 'CANDIDATE' | 'GATED' | 'PR_OPENED'
  | 'CONFIRMED' | 'ROLLED_BACK' | 'HUMAN' | 'BLOCKED' | 'STOPPED';
export type LoopEvent =
  | 'incident' | 'stop' | 'budget_denied' | 'reproduced' | 'not_reproduced' | 'candidate_ready'
  | 'gate_auto' | 'gate_human' | 'gate_block' | 'confirm_pass' | 'confirm_fail';

const TRANSITIONS: Record<LoopState, Partial<Record<LoopEvent, LoopState>>> = {
  IDLE: { incident: 'DETECTED', stop: 'STOPPED' },
  DETECTED: { reproduced: 'REPRODUCED', not_reproduced: 'HUMAN', budget_denied: 'HUMAN', stop: 'STOPPED' },
  REPRODUCED: { candidate_ready: 'CANDIDATE', stop: 'STOPPED' },
  CANDIDATE: { gate_auto: 'GATED', gate_human: 'HUMAN', gate_block: 'BLOCKED', stop: 'STOPPED' },
  GATED: { gate_auto: 'PR_OPENED', stop: 'STOPPED' },
  PR_OPENED: { confirm_pass: 'CONFIRMED', confirm_fail: 'ROLLED_BACK', stop: 'STOPPED' },
  CONFIRMED: {},
  ROLLED_BACK: {},
  HUMAN: {},
  BLOCKED: {},
  STOPPED: {},
};

/** The state machine's transition table as a pure function. Invalid moves throw. */
export function transition(state: LoopState, event: LoopEvent): LoopState {
  const next = TRANSITIONS[state][event];
  if (next === undefined) throw new Error(`invalid transition: ${state} on ${event}`);
  return next;
}

export interface Handle { dir: string }
export interface Deployment { baseUrl: string; logs(): string; stop(): void }
export interface OutboxEntry { kind: 'ticket' | 'pr' | 'page'; incidentId: string; title: string; owner: string; detail: string[] }

/** Everything the loop does to the outside world. Real adapters live in runtime.ts. */
export interface RepairEnvironment {
  now(): number;
  freeze(incident: Incident): Promise<Handle>;
  /** Apply the patch inside a copy of the base workspace. `patchText` is the observed diff between the two directories. */
  candidate(base: Handle, patchFile: string): Promise<{ handle: Handle; patchText: string }>;
  deploy(handle: Handle): Promise<Deployment>;
  /**
   * Run the frozen reproduction and regression suite from the base workspace against a
   * deployment. Candidate-supplied test files are never executed. `matchesIncident` is true
   * when a failure shows the incident's own symptom (not a stack that is down).
   */
  runReproduction(base: Handle, deployment: Deployment, incident: Incident): Promise<{ passed: boolean; matchesIncident: boolean }>;
  runRegression(base: Handle, deployment: Deployment): Promise<boolean>;
  frozenHash(handle: Handle, incident: Incident): string;
  currentHash(handle: Handle, incident: Incident): string;
  traffic(deployment: Deployment, incident: Incident, samples: number): Promise<{ samples: number; fingerprintCount: number }>;
  emit(handle: Handle, entry: OutboxEntry): void;
  record(handle: Handle, entry: { event: string; state: LoopState; detail: string }): void;
}

export interface RepairOutcome {
  state: LoopState;
  gate: GateResult | null;
  bundle: EvidenceBundle | null;
  reasons: string[];
  breaker: BreakerState;
  base: Handle | null;
}

export type Confirmation = 'confirmed' | 'insufficient-sample' | 'fingerprint-present';

/** The pre-declared confirmation rule, decided by code: enough samples and no recurrence. */
export function evaluateConfirmation(
  result: { samples: number; fingerprintCount: number },
  rule: RepairPolicy['confirm'],
): Confirmation {
  if (result.samples < rule.minSamples) return 'insufficient-sample';
  return result.fingerprintCount > rule.maxFingerprintCount ? 'fingerprint-present' : 'confirmed';
}

export interface RepairInput {
  incident: Incident;
  patchFile: string;
  breaker: BreakerState;
  policy: RepairPolicy;
  rules: ReversibilityRules;
}

export async function runRepair(env: RepairEnvironment, input: RepairInput): Promise<RepairOutcome> {
  const { incident, patchFile, policy, rules } = input;
  let breaker = input.breaker;
  let state: LoopState = 'IDLE';
  let base: Handle | null = null;
  const log = (event: string, detail: string) => base && env.record(base, { event, state, detail });
  const move = (event: LoopEvent, detail: string) => {
    state = transition(state, event);
    log(event, detail);
  };
  const finish = (reasons: string[], gateResult: GateResult | null, bundle: EvidenceBundle | null): RepairOutcome => ({
    state, gate: gateResult, bundle, reasons, breaker, base,
  });

  state = transition(state, 'incident');
  if (breaker.stop) {
    state = 'STOPPED';
    return finish([`stopped by ${breaker.stop.by}`], null, null);
  }

  const budget = budgetFor(breaker, incident.fingerprint, env.now(), policy);
  base = await env.freeze(incident);
  log('incident', `${incident.id} fingerprint ${incident.fingerprint}`);
  if (budget.attemptsUsed >= budget.attemptsAllowed || budget.cooldownActive) {
    move('budget_denied', 'attempt budget exhausted or cooldown active');
    env.emit(base, { kind: 'page', incidentId: incident.id, title: `${incident.id}: automatic attempt budget used`, owner: policy.owner, detail: ['a person must take this incident'] });
    return finish(['attempt budget exhausted or cooldown active'], null, null);
  }

  const baseDeployment = await env.deploy(base);
  const baseRun = await using(baseDeployment, () => env.runReproduction(base, baseDeployment, incident));
  const reproducedRed = !baseRun.passed && baseRun.matchesIncident;
  if (!reproducedRed) {
    const reason = baseRun.passed ? 'cannot reproduce' : 'reproduction failed for a reason other than the incident symptom';
    move('not_reproduced', reason);
    env.emit(base, { kind: 'ticket', incidentId: incident.id, title: `${incident.id}: ${reason}`, owner: policy.owner, detail: [reason] });
    breaker = recordAttempt(breaker, incident.fingerprint, env.now(), 'not-reproduced');
    return finish([reason], null, null);
  }
  move('reproduced', 'reproduction is red on the base commit with the incident symptom');

  const { handle: candidate, patchText } = await env.candidate(base, patchFile);
  move('candidate_ready', `candidate built from ${patchFile}`);
  const diff = parseDiff(patchText);
  const candidateDeployment = await env.deploy(candidate);
  return using(candidateDeployment, async () => {
    const candidateRun = await env.runReproduction(base, candidateDeployment, incident);
    const regressionPassed = await env.runRegression(base, candidateDeployment);
    const bundle: EvidenceBundle = {
      incidentId: incident.id,
      fingerprint: incident.fingerprint,
      reproduction: {
        redOnBase: reproducedRed,
        greenOnCandidate: candidateRun.passed,
        frozenSha256: env.frozenHash(base, incident),
        currentSha256: env.currentHash(candidate, incident),
      },
      regression: regressionPassed ? 'pass' : 'fail',
      diff,
      classification: classify(diff, rules),
      antimask: scanProductionDiff(diff),
      budget,
      grant: breaker.grant,
      stopEngaged: false,
    };
    const result = gate(bundle, policy);
    const detail = `${result.decision}: ${result.reasons.join('; ')}`;

    if (result.decision === 'block') {
      move('gate_block', detail);
      env.emit(base, { kind: 'page', incidentId: incident.id, title: `${incident.id}: candidate blocked`, owner: policy.owner, detail: result.reasons });
      breaker = recordAttempt(breaker, incident.fingerprint, env.now(), 'blocked');
      return finish(result.reasons, result, bundle);
    }
    if (result.decision === 'human') {
      move('gate_human', detail);
      const masked = bundle.antimask.length > 0;
      env.emit(base, {
        kind: 'ticket',
        incidentId: incident.id,
        title: masked ? `${incident.id}: root-cause ticket for a mitigation` : `${incident.id}: needs a person`,
        owner: policy.owner,
        detail: [...result.reasons, ...bundle.antimask.map((h) => `${h.rule} in ${h.file}: ${h.line}`)],
      });
      breaker = recordAttempt(breaker, incident.fingerprint, env.now(), 'human');
      return finish(result.reasons, result, bundle);
    }

    move('gate_auto', detail);
    move('gate_auto', 'evidence bundle attached to a pull request');
    env.emit(base, { kind: 'pr', incidentId: incident.id, title: `${incident.id}: repair with evidence bundle`, owner: policy.owner, detail: [`classification ${bundle.classification.reversibility}/${bundle.classification.blast}`, `merge: ${result.merge === 'unattended' ? 'unattended at' : 'a person merges at'} grant ${bundle.grant}`] });
    const traffic = await env.traffic(candidateDeployment, incident, policy.confirm.minSamples);
    const confirmation = evaluateConfirmation(traffic, policy.confirm);
    if (confirmation === 'confirmed') {
      move('confirm_pass', `${traffic.samples} samples, fingerprint seen ${traffic.fingerprintCount} times`);
      breaker = recordConfirmed(breaker, incident.fingerprint, env.now());
    } else {
      move('confirm_fail', confirmation);
      env.emit(base, { kind: 'page', incidentId: incident.id, title: `${incident.id}: confirmation failed, rolled back`, owner: policy.owner, detail: [confirmation] });
      breaker = recordAttempt(breaker, incident.fingerprint, env.now(), 'rolled-back');
    }
    return finish([confirmation], result, bundle);
  });
}

/** Stop a deployment after `fn`. A failure to stop never hides the error that `fn` threw. */
async function using<T>(deployment: Deployment, fn: () => Promise<T>): Promise<T> {
  let result: T;
  try {
    result = await fn();
  } catch (error) {
    try {
      deployment.stop();
    } catch (stopError) {
      console.error('failed to stop a deployment after an error:', stopError);
    }
    throw error;
  }
  deployment.stop();
  return result;
}

/**
 * Recurrence monitor: if the application logs show the incident's fingerprint again, report
 * it to the breaker. Inside the window after a confirmed repair this drops the grant.
 */
export function observeRecurrence(breaker: BreakerState, incident: Incident, logText: string, now: number, policy: RepairPolicy): BreakerState {
  return fingerprintsFromLog(logText).includes(incident.fingerprint)
    ? recordRecurrence(breaker, incident.fingerprint, now, policy)
    : breaker;
}
