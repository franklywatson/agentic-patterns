import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCommand, isDangerous, hasSaferAlternative } from '../core/intent.js';

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
    assert.deepEqual(classifyCommand('cat f | grep x'), ['file_read', 'text_search']);
  });

  it('returns no intents for an empty command', () => {
    assert.deepEqual(classifyCommand('   '), []);
  });
});

describe('known bypasses (string matching is a nudge, not a control)', () => {
  // These tests record current behaviour. They are not endorsements: any
  // process that can run a shell can rewrite files through a path the
  // patterns do not match. See README.md, "Docker is default-allow" and
  // the sed -i note.
  it('does not classify /usr/bin/sed -i as file_modify', () => {
    assert.deepEqual(classifyCommand("/usr/bin/sed -i 's/a/b/' f"), ['pass_through']);
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

  it('does not see through command substitution', () => {
    assert.deepEqual(classifyCommand("$(echo sed) -i 's/a/b/' f"), ['pass_through']);
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
