/**
 * Gate eval (Pattern 4.6, context eval applied to the production gate).
 *
 * Each scenario fixes an input and the exact decision the gate must return. Scoring is
 * exact: 1 for the expected decision, 0 otherwise, with no partial credit, because a gate
 * that is "mostly right" on irreversible actions is wrong. Each scenario runs K times with
 * the diff files in a different order; the scenario passes only if all K runs pass
 * (pass^k, not best-of-k). The threshold is 1.0. For an auto decision the merge (person or
 * unattended) is scored too. The scenarios are in shared/eval/gate-scenarios.json, which the
 * Python suite reads as well.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SHARED_DIR } from '../../src/config';
import { gate } from '../../src/gate';
import type { Decision, EvidenceBundle, Merge } from '../../src/types';
import { bundleFromDiff, makeDiff, patchText, policy } from '../support/builders';

/** A value in the shared file is either the same for both languages or keyed by language. */
type PerLanguage<T> = T | { typescript: T; python: T };
interface FileSpec { path: PerLanguage<string>; added?: PerLanguage<string[]>; removed?: PerLanguage<string[]>; status?: 'added' | 'modified' }
interface Scenario {
  id: string;
  category: string;
  patch?: string;
  files?: FileSpec[];
  bundle?: Partial<EvidenceBundle>;
  expected: Decision;
  merge?: Merge;
  reason: string;
}

const shared = JSON.parse(readFileSync(join(SHARED_DIR, 'eval', 'gate-scenarios.json'), 'utf-8')) as {
  k: number;
  threshold: number;
  scenarios: Scenario[];
};
const K = shared.k;
const THRESHOLD = shared.threshold;
const SCENARIOS = shared.scenarios;

const pick = <T>(value: PerLanguage<T> | undefined, fallback: T): T =>
  value === undefined ? fallback : typeof value === 'object' && value !== null && 'typescript' in value ? value.typescript : (value as T);

function build(s: Scenario): EvidenceBundle {
  const text = s.patch !== undefined
    ? patchText(s.patch)
    : (s.files ?? []).map((f) => makeDiff(pick(f.path, ''), pick(f.added, []), pick(f.removed, []), f.status ?? 'modified')).join('');
  return bundleFromDiff(text, s.bundle ?? {});
}

/** Deterministic shuffle (mulberry32) so a failure reproduces. */
function shuffled<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let a = seed + 0x6d2b79f5;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function runScenario(s: Scenario): { passK: boolean; scores: number[]; actual: string[]; reasonsOk: boolean } {
  const scores: number[] = [];
  const actual: string[] = [];
  let reasonsOk = true;
  for (let run = 0; run < K; run++) {
    const bundle = build(s);
    const input = { ...structuredClone(bundle), diff: shuffled(bundle.diff, run + 1) };
    const result = gate(input, policy);
    actual.push(`${result.decision}/${result.merge}`);
    scores.push(result.decision === s.expected && result.merge === (s.merge ?? null) ? 1 : 0);
    reasonsOk = reasonsOk && result.reasons.join('\n').includes(s.reason);
  }
  return { passK: scores.every((x) => x === 1), scores, actual, reasonsOk };
}

describe('gate eval: exact scoring, pass^k', () => {
  const results = new Map(SCENARIOS.map((s) => [s.id, runScenario(s)]));

  test.each(SCENARIOS.map((s) => [s.id, s] as const))('%s', (_id, s) => {
    const r = results.get(s.id)!;
    expect(r.actual).toEqual(Array(K).fill(`${s.expected}/${s.merge ?? null}`));
    expect(r.reasonsOk).toBe(true);
  });

  test('suite covers every decision and both merges, with at least 30 scenarios and k of at least 5', () => {
    expect(K).toBeGreaterThanOrEqual(5);
    expect(THRESHOLD).toBe(1);
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
    expect(new Set(SCENARIOS.map((s) => s.expected))).toEqual(new Set(['auto', 'human', 'block']));
    expect(new Set(SCENARIOS.filter((s) => s.expected === 'auto').map((s) => s.merge))).toEqual(new Set(['person', 'unattended']));
    expect(SCENARIOS.filter((s) => s.expected !== 'auto' && s.merge !== undefined)).toEqual([]);
  });

  test('overall pass^k meets the threshold, and every category does', () => {
    const passed = SCENARIOS.filter((s) => results.get(s.id)!.passK && results.get(s.id)!.reasonsOk).length;
    const overall = passed / SCENARIOS.length;
    const byCategory: Record<string, number> = {};
    for (const category of new Set(SCENARIOS.map((s) => s.category))) {
      const inCategory = SCENARIOS.filter((s) => s.category === category);
      byCategory[category] = inCategory.filter((s) => results.get(s.id)!.passK).length / inCategory.length;
    }
    console.log(`gate eval: pass^${K} = ${overall.toFixed(3)} over ${SCENARIOS.length} scenarios`, byCategory);
    expect(overall).toBeGreaterThanOrEqual(THRESHOLD);
    expect(Object.values(byCategory).every((score) => score >= THRESHOLD)).toBe(true);
  });
});
