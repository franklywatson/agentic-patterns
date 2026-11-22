import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyCommand,
  isDangerous,
  hasSaferAlternative,
  splitCompoundCommand,
  hasFileRedirect,
} from '../core/intent.js';

describe('classifyCommand', () => {
  it('classifies each simple command into its intent', () => {
    assert.deepEqual(classifyCommand('cat file.txt'), ['file_read']);
    assert.deepEqual(classifyCommand('head -n 5 file.txt'), ['file_read']);
    assert.deepEqual(classifyCommand('tail -f app.log'), ['file_read']);
    assert.deepEqual(classifyCommand('grep -r foo src'), ['text_search']);
    assert.deepEqual(classifyCommand('rg foo'), ['text_search']);
    assert.deepEqual(classifyCommand('find . -name "*.ts"'), ['file_discovery']);
    assert.deepEqual(classifyCommand('fd pattern'), ['file_discovery']);
    assert.deepEqual(classifyCommand('docker ps'), ['docker']);
    assert.deepEqual(classifyCommand('docker-compose up -d'), ['docker']);
    assert.deepEqual(classifyCommand('ls -la'), ['pass_through']);
  });

  it('classifies sed -i and sed --in-place as file_modify, not text_search', () => {
    assert.deepEqual(classifyCommand("sed -i 's/a/b/g' file.txt"), ['file_modify']);
    assert.deepEqual(classifyCommand("sed --in-place 's/a/b/g' file.txt"), ['file_modify']);
  });

  it('classifies awk with a redirect as file_modify', () => {
    assert.deepEqual(classifyCommand("awk '{print $1}' in.txt > out.txt"), ['file_modify']);
  });

  it('classifies awk without an unquoted redirect as pass_through', () => {
    assert.deepEqual(classifyCommand("awk '{print $1}' in.txt"), ['pass_through']);
    assert.deepEqual(classifyCommand(`awk '{print "a > b"}' f.txt`), ['pass_through']);
    assert.deepEqual(classifyCommand('awk -f p.awk in 2>&1'), ['pass_through']);
  });

  it('classifies sed without -i as pass_through', () => {
    assert.deepEqual(classifyCommand("sed 's/a/b/g' file.txt"), ['pass_through']);
  });

  it('classifies each segment of a compound command independently', () => {
    assert.deepEqual(
      classifyCommand('cat file.txt && grep pattern file.txt'),
      ['file_read', 'text_search'],
    );
    assert.deepEqual(
      classifyCommand("ls; sed -i 's/a/b/' f || docker ps"),
      ['pass_through', 'file_modify', 'docker'],
    );
  });

  it('does not flag an advisory segment that only filters piped output', () => {
    assert.deepEqual(classifyCommand('git log | grep fix'), ['pass_through']);
    assert.deepEqual(classifyCommand('cat f | grep x'), ['file_read']);
  });

  it('still checks post-pipe segments for writes', () => {
    assert.deepEqual(classifyCommand('true | echo x > f.txt'), ['pass_through', 'file_modify']);
    assert.deepEqual(
      classifyCommand("cat f | sed -i 's/a/b/' g"),
      ['file_read', 'file_modify'],
    );
  });

  it('keeps non-advisory post-pipe intents such as docker', () => {
    assert.deepEqual(classifyCommand('curl -s x | docker load'), ['pass_through', 'docker']);
  });

  it('returns no intents for an empty command', () => {
    assert.deepEqual(classifyCommand('   '), []);
  });
});

describe('splitCompoundCommand', () => {
  it('splits on unquoted &&, ||, ; and | and marks pipeline members', () => {
    assert.deepEqual(splitCompoundCommand('a && b || c; d | e'), [
      { text: 'a', viaPipe: false },
      { text: 'b', viaPipe: false },
      { text: 'c', viaPipe: false },
      { text: 'd', viaPipe: false },
      { text: 'e', viaPipe: true },
    ]);
  });

  it('treats separators inside quotes as data', () => {
    assert.deepEqual(
      splitCompoundCommand('echo "a; b"'),
      [{ text: 'echo "a; b"', viaPipe: false }],
    );
    assert.deepEqual(
      splitCompoundCommand("grep 'a|b' f"),
      [{ text: "grep 'a|b' f", viaPipe: false }],
    );
    assert.deepEqual(
      splitCompoundCommand('echo "a && b"'),
      [{ text: 'echo "a && b"', viaPipe: false }],
    );
  });

  it('treats a backslash-escaped ; as data (find -exec terminator)', () => {
    assert.deepEqual(
      splitCompoundCommand('find . -name "*.py" -exec rm {} \\;'),
      [{ text: 'find . -name "*.py" -exec rm {} \\;', viaPipe: false }],
    );
  });

  it('treats a backslash-escaped pipe as data', () => {
    assert.deepEqual(
      splitCompoundCommand('grep foo \\| bar f'),
      [{ text: 'grep foo \\| bar f', viaPipe: false }],
    );
  });

  it('drops empty segments', () => {
    assert.deepEqual(splitCompoundCommand('a;; b'), [
      { text: 'a', viaPipe: false },
      { text: 'b', viaPipe: false },
    ]);
  });
});

describe('hasFileRedirect', () => {
  it('detects an unquoted redirect that writes a file', () => {
    assert.equal(hasFileRedirect('echo x > f.txt'), true);
    assert.equal(hasFileRedirect('sort f >> out.txt'), true);
    assert.equal(hasFileRedirect('awk -f p in 2> err.txt'), true);
    assert.equal(hasFileRedirect('cmd >&both.txt'), true);
    assert.equal(hasFileRedirect('>out.txt'), true);
  });

  it('ignores fd duplication, sinks and process substitution', () => {
    assert.equal(hasFileRedirect('awk -f p.awk in 2>&1'), false);
    assert.equal(hasFileRedirect('cmd >&2'), false);
    assert.equal(hasFileRedirect('cmd 2>&-'), false);
    assert.equal(hasFileRedirect('grep x f.txt 2>/dev/null'), false);
    assert.equal(hasFileRedirect('cmd > /dev/null 2>&1'), false);
    assert.equal(hasFileRedirect('tee >(md5sum)'), false);
    assert.equal(hasFileRedirect('echo done >'), false);
  });

  it('ignores a > that is quoted or escaped data', () => {
    assert.equal(hasFileRedirect(`awk '{print "a > b"}' f.txt`), false);
    assert.equal(hasFileRedirect("echo 'a > b'"), false);
    assert.equal(hasFileRedirect('echo \\> f'), false);
  });

  it('does not treat /dev/null with a suffix as the sink', () => {
    assert.equal(hasFileRedirect('cmd 2>/dev/nullx'), true);
  });
});

describe('known classifier bypasses (string matching is a nudge, not a control)', () => {
  // The classifier anchors at the start of each segment. These tests record
  // current behaviour; any process that can run a shell can rewrite files
  // through a path the patterns do not match.
  it('does not classify /usr/bin/sed -i as file_modify', () => {
    assert.deepEqual(classifyCommand("/usr/bin/sed -i 's/a/b/' f"), ['pass_through']);
  });

  it('does not classify sed -E -i as file_modify', () => {
    assert.deepEqual(classifyCommand("sed -E -i 's/a/b/' f"), ['pass_through']);
  });

  it('does not classify perl -pi as file_modify', () => {
    assert.deepEqual(classifyCommand("perl -pi -e 's/a/b/' f"), ['pass_through']);
  });

  it('does not classify python -c file writes as file_modify', () => {
    assert.deepEqual(
      classifyCommand(`python -c "open('f','w').write('x')"`),
      ['pass_through'],
    );
  });

  it('does not see through runtime-assembled commands', () => {
    assert.deepEqual(classifyCommand("$(echo sed) -i 's/a/b/' f"), ['pass_through']);
    assert.deepEqual(classifyCommand("S=sed; $S -i 's/a/b/' f"), ['pass_through', 'pass_through']);
  });

  it('does not flag echo sed -i (anchoring avoids the router false positive)', () => {
    assert.deepEqual(classifyCommand('echo sed -i hi'), ['pass_through']);
  });

  it('does not split on a single & (background operator)', () => {
    assert.deepEqual(classifyCommand("sleep 5 & sed -i 's/a/b/' f"), ['pass_through']);
  });
});

describe('intent predicates', () => {
  it('flags only file_modify as dangerous', () => {
    assert.equal(isDangerous('file_modify'), true);
    assert.equal(isDangerous('file_read'), false);
    assert.equal(isDangerous('docker'), false);
  });

  it('reports a safer alternative for read, search and discovery only', () => {
    assert.equal(hasSaferAlternative('file_read'), true);
    assert.equal(hasSaferAlternative('text_search'), true);
    assert.equal(hasSaferAlternative('file_discovery'), true);
    assert.equal(hasSaferAlternative('file_modify'), false);
    assert.equal(hasSaferAlternative('docker'), false);
    assert.equal(hasSaferAlternative('pass_through'), false);
  });
});
