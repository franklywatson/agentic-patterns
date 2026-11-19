import type { AntimaskHit, DiffFile } from './types';

// Pattern 1.6 forbidden patterns, applied to production diffs: a change that makes the
// failure disappear without removing its cause is a mitigation, not a fix.
const CATCH = /\bcatch\b|\.catch\s*\(/;
const RETHROW = /\bthrow\b/;
const RETRY = /\b(retry|retries|backoff)\b/i;
const NUMERIC_SETTING = /\b(\w*(?:timeout|ttl|deadline|threshold|min[A-Z_]\w*|required\w*)\w*)\s*[:=]\s*(\d+(?:\.\d+)?)/i;
const WIDENING_KEY = /timeout|ttl|deadline/i;
const LOWERING_KEY = /threshold|^min|required/i;
const CATCH_WINDOW = 6;

function numericSettings(lines: string[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const line of lines) {
    const m = NUMERIC_SETTING.exec(line);
    if (m) out.set(m[1].toLowerCase(), Number(m[2]));
  }
  return out;
}

/** Scan the added lines of non-test files. Returns every hit; an empty list means clean. */
export function scanProductionDiff(files: DiffFile[]): AntimaskHit[] {
  const hits: AntimaskHit[] = [];
  for (const file of files) {
    if (file.path.startsWith('tests/') || file.status === 'deleted') continue;
    file.added.forEach((line, index) => {
      if (CATCH.test(line)) {
        const following = file.added.slice(index, index + CATCH_WINDOW).join('\n');
        if (!RETHROW.test(following)) hits.push({ rule: 'swallowed-exception', file: file.path, line: line.trim() });
      }
      if (RETRY.test(line)) hits.push({ rule: 'new-retry', file: file.path, line: line.trim() });
    });
    const before = numericSettings(file.removed);
    const after = numericSettings(file.added);
    for (const [key, value] of after) {
      const previous = before.get(key);
      if (previous === undefined) continue;
      if (WIDENING_KEY.test(key) && value > previous) {
        hits.push({ rule: 'widened-timeout', file: file.path, line: `${key}: ${previous} -> ${value}` });
      }
      if (LOWERING_KEY.test(key) && value < previous) {
        hits.push({ rule: 'lowered-threshold', file: file.path, line: `${key}: ${previous} -> ${value}` });
      }
    }
  }
  return hits;
}
