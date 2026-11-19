import { globMatch } from './diff';
import type { Blast, Classification, DiffFile, Reversibility } from './types';
import type { ReversibilityRules } from './config';

const R_ORDER: Reversibility[] = ['R0', 'R1', 'R2', 'R3', 'R4'];
const B_ORDER: Blast[] = ['B0', 'B1', 'B2', 'B3'];

export const maxR = (a: Reversibility, b: Reversibility): Reversibility =>
  R_ORDER.indexOf(a) >= R_ORDER.indexOf(b) ? a : b;
export const maxB = (a: Blast, b: Blast): Blast => (B_ORDER.indexOf(a) >= B_ORDER.indexOf(b) ? a : b);
export const exceeds = (
  value: { reversibility: Reversibility; blast: Blast },
  ceiling: { reversibility: Reversibility; blast: Blast },
): boolean =>
  R_ORDER.indexOf(value.reversibility) > R_ORDER.indexOf(ceiling.reversibility) ||
  B_ORDER.indexOf(value.blast) > B_ORDER.indexOf(ceiling.blast);

/**
 * Classify a diff deterministically. Each file takes the class of its first matching path
 * rule; a file with no rule takes the "unknown" class (the highest). Content rules raise
 * the class when a production file's changed lines match. An empty diff is unknown.
 */
export function classify(files: DiffFile[], rules: ReversibilityRules): Classification {
  if (files.length === 0) {
    return { ...rules.unknown, reasons: ['empty diff: unknown classifies as the highest class'] };
  }
  let reversibility: Reversibility = 'R0';
  let blast: Blast = 'B0';
  const reasons: string[] = [];
  for (const file of files) {
    const rule = rules.paths.find((p) => globMatch(p.glob, file.path));
    if (rule) {
      reversibility = maxR(reversibility, rule.reversibility);
      blast = maxB(blast, rule.blast);
      reasons.push(`${file.path}: ${rule.glob} -> ${rule.reversibility}/${rule.blast}`);
    } else {
      reversibility = maxR(reversibility, rules.unknown.reversibility);
      blast = maxB(blast, rules.unknown.blast);
      reasons.push(`${file.path}: no rule, unknown -> ${rules.unknown.reversibility}/${rules.unknown.blast}`);
    }
    if (file.path.startsWith('tests/')) continue;
    const changed = [...file.added, ...file.removed].join('\n');
    for (const content of rules.content) {
      if (new RegExp(content.pattern, 'i').test(changed)) {
        if (content.reversibility) reversibility = maxR(reversibility, content.reversibility);
        if (content.blast) blast = maxB(blast, content.blast);
        reasons.push(`${file.path}: content rule ${content.name}`);
      }
    }
  }
  return { reversibility, blast, reasons };
}
