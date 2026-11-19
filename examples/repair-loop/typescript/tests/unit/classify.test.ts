import { classify } from '../../src/classify';
import { globMatch, parseDiff } from '../../src/diff';
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

  test('the class of a diff is the maximum over its files', () => {
    const text = makeDiff('tests/unit/a.test.ts', ['x'], [], 'added') + makeDiff('app/src/infra.ts', ['y']);
    expect(classify(parseDiff(text), rules)).toMatchObject({ reversibility: 'R2', blast: 'B1' });
  });
});
