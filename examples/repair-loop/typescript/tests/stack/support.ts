import { join } from 'node:path';
import { newBreaker } from '../../src/breaker';
import { loadIncidentRecord, loadPolicy, loadRules } from '../../src/config';
import { parseIncident } from '../../src/incident';
import { runRepair, type RepairOutcome } from '../../src/loop';
import { createEnvironment, readJsonLines, removeWorkspaces } from '../../src/runtime';
import type { BreakerState } from '../../src/breaker';
import type { OutboxEntry } from '../../src/loop';

export const patchPath = (name: string): string => join(__dirname, '..', '..', 'patches', name);

export const incident = (id = 'INC-001') => parseIncident(loadIncidentRecord(id));

export async function repairWith(patchName: string, breaker?: BreakerState) {
  const env = createEnvironment();
  const policy = loadPolicy();
  const outcome: RepairOutcome = await runRepair(env, {
    incident: incident(),
    patchFile: patchPath(patchName),
    breaker: breaker ?? newBreaker(policy.grant),
    policy,
    rules: loadRules(),
  });
  return { env, outcome, policy };
}

export const outboxOf = (outcome: RepairOutcome): OutboxEntry[] =>
  readJsonLines<OutboxEntry>(outcome.base!, 'outbox.jsonl');

export const registerEventsOf = (outcome: RepairOutcome): string[] =>
  readJsonLines<{ event: string }>(outcome.base!, 'register.jsonl').map((e) => e.event);

export const cleanup = (outcome: RepairOutcome | undefined): void => {
  if (outcome?.base) removeWorkspaces(outcome.base);
};
