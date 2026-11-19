import { scanProductionDiff } from './antimask';
import { budgetFor, recordAttempt, recordConfirmed, type BreakerState } from './breaker';
import { classify } from './classify';
import type { ReversibilityRules } from './config';
import { parseDiff } from './diff';
import { gate } from './gate';
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
  candidate(base: Handle, patchFile: string): Promise<{ handle: Handle; patchText: string }>;
  deploy(handle: Handle): Promise<Deployment>;
  runReproduction(handle: Handle, deployment: Deployment): Promise<boolean>;
  runRegression(handle: Handle, deployment: Deployment): Promise<boolean>;
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
  let reproducedRed: boolean;
  try {
    reproducedRed = !(await env.runReproduction(base, baseDeployment));
  } finally {
    baseDeployment.stop();
  }
  if (!reproducedRed) {
    move('not_reproduced', 'reproduction passed on the base commit');
    env.emit(base, { kind: 'ticket', incidentId: incident.id, title: `${incident.id}: cannot reproduce`, owner: policy.owner, detail: ['the reproduction was not red on the base commit'] });
    breaker = recordAttempt(breaker, incident.fingerprint, env.now(), 'not-reproduced');
    return finish(['cannot reproduce'], null, null);
  }
  move('reproduced', 'reproduction is red on the base commit');

  const { handle: candidate, patchText } = await env.candidate(base, patchFile);
  move('candidate_ready', `candidate built from ${patchFile}`);
  const diff = parseDiff(patchText);
  const candidateDeployment = await env.deploy(candidate);
  try {
    const greenOnCandidate = await env.runReproduction(candidate, candidateDeployment);
    const regressionPassed = await env.runRegression(candidate, candidateDeployment);
    const bundle: EvidenceBundle = {
      incidentId: incident.id,
      fingerprint: incident.fingerprint,
      reproduction: {
        redOnBase: reproducedRed,
        greenOnCandidate,
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
    env.emit(base, { kind: 'pr', incidentId: incident.id, title: `${incident.id}: repair with evidence bundle`, owner: policy.owner, detail: [`classification ${bundle.classification.reversibility}/${bundle.classification.blast}`, 'merge by a person: the grant is below A4'] });
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
  } finally {
    candidateDeployment.stop();
  }
}
