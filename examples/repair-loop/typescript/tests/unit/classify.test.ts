import { classify } from '../../src/classify';
import { globMatch, normalizePath, parseDiff } from '../../src/diff';
import { makeDiff, patchText, rules } from '../support/builders';

describe('parseDiff and globMatch', () => {
  test('parseDiff reads status, paths and changed lines', () => {
    const files = parseDiff(patchText('INC-001.fix.patch'));
    expect(files).toHaveLength(1);
    expect(files[0].path).toBe('app/src/routes/users.ts');
    expect(files[0].status).toBe('modified');
    expect(files[0].added.join('\n')).toContain('UUID.test');
    expect(files[0].removed).toEqual([]);
  });

  test('parseDiff follows hunk counts: a removed line starting with "-- " hides nothing', () => {
    const text = [
      '--- a/app/src/routes/users.ts',
      '+++ b/app/src/routes/users.ts',
      '@@ -1,2 +1,3 @@',
      '--- sql comment',
      ' keep',
      '+} catch {}',
      '+retries = 3;',
      '',
    ].join('\n');
    const [file] = parseDiff(text);
    expect(file.removed).toEqual(['-- sql comment']);
    expect(file.added).toEqual(['} catch {}', 'retries = 3;']);
  });

  test('parseDiff reads a directory diff: first path component stripped, added files detected by hunk', () => {
    const text = ['--- base/tests/x.ts\t1970-01-01', '+++ base-candidate/tests/x.ts\t2026-01-01', '@@ -0,0 +1,1 @@', '+x', ''].join('\n');
    expect(parseDiff(text)).toEqual([{ path: 'tests/x.ts', status: 'added', added: ['x'], removed: [] }]);
  });

  test('parseDiff marks files created from /dev/null as added', () => {
    expect(parseDiff(makeDiff('tests/unit/new.test.ts', ['x'], [], 'added'))[0].status).toBe('added');
  });

  test('globMatch: ** crosses directories, * does not', () => {
    expect(globMatch('app/src/routes/**', 'app/src/routes/users.ts')).toBe(true);
    expect(globMatch('app/src/routes/**', 'app/src/routes/deep/x.ts')).toBe(true);
    expect(globMatch('app/src/*.ts', 'app/src/routes/users.ts')).toBe(false);
    expect(globMatch('**/*.md', 'docs/a/b.md')).toBe(true);
    expect(globMatch('app/src/auth.*', 'app/src/auth.ts')).toBe(true);
  });
});

describe('normalizePath', () => {
  test('collapses redundant segments of a safe path', () => {
    expect(normalizePath('app/src/./auth.ts')).toBe('app/src/auth.ts');
    expect(normalizePath('tests//x.ts')).toBe('tests/x.ts');
  });

  test('returns an unsafe path unchanged so that it stays visible', () => {
    expect(normalizePath('tests/../app/x.ts')).toBe('tests/../app/x.ts');
    expect(normalizePath('/etc/x')).toBe('/etc/x');
  });
});

describe('classify', () => {
  test('the real fix is R2/B0', () => {
    const result = classify(parseDiff(patchText('INC-001.fix.patch')), rules);
    expect(result).toMatchObject({ reversibility: 'R2', blast: 'B0' });
  });

  test('a test-only diff is R0/B0', () => {
    expect(classify(parseDiff(patchText('INC-001.test-edit.patch')), rules)).toMatchObject({ reversibility: 'R0', blast: 'B0' });
  });

  test('a file with no rule takes the unknown class, the highest', () => {
    expect(classify(parseDiff(makeDiff('scripts/deploy.sh', ['echo hi'])), rules)).toMatchObject({ reversibility: 'R4', blast: 'B3' });
  });

  test('an empty diff is unknown, not clean', () => {
    expect(classify([], rules)).toMatchObject({ reversibility: 'R4', blast: 'B3' });
  });

  test('the auth module is B3 by path', () => {
    expect(classify(parseDiff(makeDiff('app/src/auth.ts', ['const a = 1;'])), rules)).toMatchObject({ reversibility: 'R2', blast: 'B3' });
  });

  test('a schema statement in a route raises the class to R3', () => {
    const diff = makeDiff('app/src/routes/users.ts', ['await pool.query("ALTER TABLE users ADD COLUMN x INT");']);
    expect(classify(parseDiff(diff), rules)).toMatchObject({ reversibility: 'R3', blast: 'B0' });
  });

  test('an outbound HTTP call raises the class to R4', () => {
    const diff = makeDiff('app/src/routes/users.ts', ['await fetch("https://mail.example.test/send");']);
    expect(classify(parseDiff(diff), rules).reversibility).toBe('R4');
  });

  test('a changed line that mentions a password raises blast to B3', () => {
    const diff = makeDiff('app/src/routes/users.ts', ['const password = req.body.password;']);
    expect(classify(parseDiff(diff), rules).blast).toBe('B3');
  });

  test('an openapi change is B2', () => {
    expect(classify(parseDiff(makeDiff('app/openapi.yaml', ['x'])), rules)).toMatchObject({ reversibility: 'R2', blast: 'B2' });
  });

  test('unsafe paths take the unknown class and are not normalized into a lower one', () => {
    for (const path of ['app/src/routes/../auth.ts', 'tests/../app/src/routes/evil.ts']) {
      expect(classify(parseDiff(makeDiff(path, ['x'])), rules)).toMatchObject({ reversibility: 'R4', blast: 'B3' });
    }
  });

  test('redundant segments in a safe path are normalized before matching', () => {
    expect(classify(parseDiff(makeDiff('app/src/./auth.ts', ['x'])), rules)).toMatchObject({ blast: 'B3' });
  });

  test('the class of a diff is the maximum over its files', () => {
    const text = makeDiff('tests/unit/a.test.ts', ['x'], [], 'added') + makeDiff('app/src/infra.ts', ['y']);
    expect(classify(parseDiff(text), rules)).toMatchObject({ reversibility: 'R2', blast: 'B1' });
  });
});

describe('parseDiff reads names from headers, git lines and binary lines (r10 C2)', () => {
  const paths = (lines: string[]) => parseDiff(`${lines.join('\n')}\n`).map((f) => (f.unparsed ? `unparsed: ${f.path}` : `${f.status} ${f.path}`));

  test('a Binary files line splits on the " and " that names one path on both sides', () => {
    expect(paths(['Binary files base/tests/a and X/app/y.bin and cand/tests/a and X/app/y.bin differ'])).toEqual(['modified tests/a and X/app/y.bin']);
    expect(paths(['Binary files /dev/null and b/app/a and b.bin differ'])).toEqual(['modified app/a and b.bin']);
  });

  test('a Binary files line with no single reading is unparsed', () => {
    expect(paths(['Binary files base/app/a and cand/b and base/app/c differ'])).toEqual(['unparsed: Binary files base/app/a and cand/b and base/app/c differ']);
    expect(paths(['Binary files /dev/null and b/x and /dev/null differ'])).toEqual(['unparsed: Binary files /dev/null and b/x and /dev/null differ']);
  });

  test('a header with a tab inside the name is unparsed; a quoted header is read with C escapes', () => {
    expect(paths(['--- base/app/a\tb.ts\t2026-01-01', '+++ cand/app/a\tb.ts\t2026-01-01', '@@ -0,0 +1 @@', '+x'])).toEqual(['unparsed: +++ cand/app/a\tb.ts\t2026-01-01']);
    expect(paths(['--- /dev/null', '+++ "b/app/caf\\303\\251\\tx.ts"', '@@ -0,0 +1 @@', '+x'])).toEqual(['added app/café\tx.ts']);
    expect(paths(['--- /dev/null', '+++ "b/app/bad\\q.ts"', '@@ -0,0 +1 @@', '+x'])).toEqual(['unparsed: +++ "b/app/bad\\q.ts"']);
  });

  test('a git rename lists both paths, from the rename lines', () => {
    expect(paths(['diff --git a/tests/x.ts b/app/x.ts', 'similarity index 100%', 'rename from tests/x.ts', 'rename to app/x.ts'])).toEqual(['modified app/x.ts', 'deleted tests/x.ts']);
    expect(paths(['diff --git a/tests/x.ts b/app/x.ts', 'rename from tests/x.ts', 'rename to app/x.ts', '--- a/tests/x.ts', '+++ b/app/x.ts', '@@ -1 +1 @@', '-a', '+b'])).toEqual(['modified app/x.ts', 'deleted tests/x.ts']);
  });

  test('a git diff header with spaces is read when both sides agree; a GIT binary patch block is skipped', () => {
    expect(paths(['diff --git a/app/a b.bin b/app/a b.bin', 'new file mode 100644', 'index 0000000..1111111', 'GIT binary patch', 'literal 4', 'LcmZQzWMT#Y01f~L', '', 'literal 0', 'HcmV?d00001', '', 'diff --git a/app/c.ts b/app/c.ts', '--- a/app/c.ts', '+++ b/app/c.ts', '@@ -1 +1 @@', '-a', '+b'])).toEqual(['modified app/a b.bin', 'modified app/c.ts']);
  });

  test('a line diff -r prints for a type change is unparsed', () => {
    expect(paths(['File base/app/x is a regular file while file cand/app/x is a directory'])).toEqual(['unparsed: File base/app/x is a regular file while file cand/app/x is a directory']);
  });

  test('an unparsed entry classifies as unknown', () => {
    const c = classify(parseDiff('Binary files base/app/a and cand/b and base/app/c differ\n'), rules);
    expect([c.reversibility, c.blast]).toEqual(['R4', 'B3']);
    expect(c.reasons.join('\n')).toContain('cannot be read as one file path');
  });
});

describe('instruction and tool-config surfaces at any depth and in any case are medium tier (B1)', () => {
  test.each([
    'CLAUDE.md', 'app/CLAUDE.md', 'CLAUDE.local.md', 'app/claude.LOCAL.md', 'AGENTS.md', 'docs/agents.md', 'GEMINI.md', 'app/Gemini.md',
    '.claude/rules/x.md', 'app/.claude/skills/x/SKILL.md', 'app/.claude/skills/x/run.sh', '.claude/agents/r.md', '.claude/commands/c.md',
    '.mcp.json', 'app/.mcp.json',
  ])('%s is R0/B1', (path) => {
    const c = classify(parseDiff(makeDiff(path, ['text'])), rules);
    expect([c.reversibility, c.blast]).toEqual(['R0', 'B1']);
  });

  test.each(['.claude/settings.json', '.claude/settings.local.json', 'app/.claude/settings.json', '.claude/hooks/guard.sh', 'app/.claude/hooks/x.sh'])(
    '%s is high tier (R4/B3)',
    (path) => {
      const c = classify(parseDiff(makeDiff(path, ['{}'])), rules);
      expect([c.reversibility, c.blast]).toEqual(['R4', 'B3']);
    },
  );
});

test('a glob wildcard does not match a line terminator, in either language', () => {
  for (const path of ['app/src/routes/\rx.ts', 'app/src/routes/x .ts', 'app/src/routes/a\nb.ts']) {
    expect(globMatch('app/src/routes/**', path)).toBe(false);
    expect(globMatch('app/src/routes/*', path)).toBe(false);
  }
  expect(globMatch('app/src/routes/**', 'app/src/routes/a/b.ts')).toBe(true);
});
