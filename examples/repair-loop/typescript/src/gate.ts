import { exceeds } from './classify';
import { globMatch, isUnsafePath, normalizePath } from './diff';
import type { Decision, EvidenceBundle, GatePolicy, GateResult, Grant } from './types';

const GRANT_ORDER: Grant[] = ['A1', 'A2', 'A3', 'A4', 'A5'];
const SEVERITY: Record<Decision, number> = { auto: 0, human: 1, block: 2 };

/**
 * The production gate: a pure function of the evidence bundle and the policy. It returns
 * the most severe decision any check produced (block > human > auto, as in Pattern 2.3)
 * and every reason, so the outcome is explainable and eval-able. The repair agent cannot
 * call this with a bundle it assembled itself: the loop builds the bundle from
 * observations (hashes, test runs, the applied diff).
 */
export function gate(bundle: EvidenceBundle, policy: GatePolicy): GateResult {
  const findings: { decision: Decision; reason: string }[] = [];
  const add = (decision: Decision, reason: string) => findings.push({ decision, reason });

  if (bundle.stopEngaged) add('block', 'stop switch is engaged');

  const { reproduction } = bundle;
  if (reproduction.frozenSha256 !== reproduction.currentSha256) {
    add('block', 'reproduction test changed after it was frozen');
  }
  for (const file of bundle.diff) {
    if (isUnsafePath(file.path)) {
      add('block', `diff contains unsafe path ${file.path}`);
    } else if (policy.protectedPaths.some((glob) => globMatch(glob, normalizePath(file.path)))) {
      add('block', `diff touches protected path ${file.path}`);
    }
  }
  if (!reproduction.greenOnCandidate) add('block', 'reproduction is not green on the candidate');
  if (bundle.regression !== 'pass') add('block', 'regression suite is not green on the candidate');

  if (!reproduction.redOnBase) add('human', 'reproduction was not red on the base commit: cannot reproduce');
  if (bundle.antimask.length > 0) {
    add('human', `anti-masking scan found ${bundle.antimask.length} hit(s): treated as a mitigation`);
  }
  if (exceeds(bundle.classification, policy.autoCeiling)) {
    const { reversibility, blast } = bundle.classification;
    add('human', `class ${reversibility}/${blast} is above the ceiling ${policy.autoCeiling.reversibility}/${policy.autoCeiling.blast}`);
  }
  if (GRANT_ORDER.indexOf(bundle.grant) < GRANT_ORDER.indexOf(policy.minGrantForAuto)) {
    add('human', `grant ${bundle.grant} is below ${policy.minGrantForAuto}`);
  }
  if (bundle.budget.attemptsUsed >= bundle.budget.attemptsAllowed) add('human', 'attempt budget is exhausted for this fingerprint');
  if (bundle.budget.cooldownActive) add('human', 'cooldown is active for this fingerprint');

  const decision = findings.reduce<Decision>(
    (worst, f) => (SEVERITY[f.decision] > SEVERITY[worst] ? f.decision : worst),
    'auto',
  );
  const reasons = findings.filter((f) => f.decision === decision).map((f) => f.reason);
  return { decision, reasons: decision === 'auto' ? ['all mechanical checks passed within the ceiling'] : reasons };
}
