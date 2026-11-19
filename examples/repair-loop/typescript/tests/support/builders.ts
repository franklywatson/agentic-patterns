import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanProductionDiff } from '../../src/antimask';
import { classify } from '../../src/classify';
import { loadPolicy, loadRules } from '../../src/config';
import { parseDiff } from '../../src/diff';
import type { EvidenceBundle } from '../../src/types';

export const policy = loadPolicy();
export const rules = loadRules();

export const patchText = (name: string): string =>
  readFileSync(join(__dirname, '..', '..', 'patches', name), 'utf-8');

/** An evidence bundle that the gate accepts. Tests override single fields. */
export function cleanBundle(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  const diff = parseDiff(patchText('INC-001.fix.patch'));
  return {
    incidentId: 'INC-001',
    fingerprint: '92e2a8020bd5',
    reproduction: { redOnBase: true, greenOnCandidate: true, frozenSha256: 'aaa', currentSha256: 'aaa' },
    regression: 'pass',
    diff,
    classification: classify(diff, rules),
    antimask: scanProductionDiff(diff),
    budget: { attemptsUsed: 0, attemptsAllowed: 1, cooldownActive: false },
    grant: 'A3',
    stopEngaged: false,
    ...overrides,
  };
}

/** Build a bundle from a diff text: classification and scan come from the real modules. */
export function bundleFromDiff(text: string, overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  const diff = parseDiff(text);
  return cleanBundle({ diff, classification: classify(diff, rules), antimask: scanProductionDiff(diff), ...overrides });
}

/** Build a one-file unified diff with the given added and removed lines. */
export function makeDiff(path: string, added: string[], removed: string[] = [], status: 'added' | 'modified' = 'modified'): string {
  const old = status === 'added' ? '/dev/null' : `a/${path}`;
  return [
    `--- ${old}`,
    `+++ b/${path}`,
    `@@ -${status === 'added' ? 0 : 1},${removed.length} +1,${added.length} @@`,
    ...removed.map((l) => `-${l}`),
    ...added.map((l) => `+${l}`),
    '',
  ].join('\n');
}
