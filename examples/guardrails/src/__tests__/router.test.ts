import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findMatchingRule, ROUTING_RULES } from '../config/routing.config.js';
import { resolve, requiresAction, formatResolution, type Resolution } from '../core/router.js';
import { formatEnvironment, type Environment } from '../core/environment.js';

function env(overrides: Partial<Environment> = {}): Environment {
  return {
    rtkAvailable: false,
    jcodemunchIndexed: false,
    stackTestActive: false,
    detectedAt: 0,
    ...overrides,
  };
}

function route(command: string, environment: Environment): Resolution {
  const rule = findMatchingRule(command);
  assert.notEqual(rule, null);
  return resolve(rule!, environment);
}

describe('environment-aware resolution for grep', () => {
  it('advises rtk grep when RTK is available', () => {
    assert.deepEqual(route('grep -r foo src', env({ rtkAvailable: true })), {
      action: 'advise',
      tool: 'rtk grep',
      reason: 'structured output, filtered results',
    });
  });

  it('advises jcodemunch search_text when only jcodemunch is indexed', () => {
    const resolution = route('grep -r foo src', env({ jcodemunchIndexed: true }));
    assert.equal(resolution.action, 'advise');
    assert.equal((resolution as { tool: string }).tool, 'jcodemunch search_text');
  });

  it('prefers RTK over jcodemunch when both are available', () => {
    const resolution = route('grep foo', env({ rtkAvailable: true, jcodemunchIndexed: true }));
    assert.equal((resolution as { tool: string }).tool, 'rtk grep');
  });

  it('allows grep when neither RTK nor an index is available, and never advises the Grep tool', () => {
    assert.deepEqual(route('grep foo', env()), { action: 'allow' });
    assert.deepEqual(route('rg foo', env()), { action: 'allow' });
  });
});

describe('environment-aware resolution for other intents', () => {
  it('advises the Read tool for cat regardless of RTK', () => {
    assert.equal((route('cat a.txt', env()) as { tool: string }).tool, 'Read tool');
    assert.equal(
      (route('cat a.txt', env({ rtkAvailable: true })) as { tool: string }).tool,
      'Read tool',
    );
  });

  it('advises jcodemunch get_file_tree for find when indexed, allows it otherwise', () => {
    assert.equal(
      (route('find . -name x', env({ jcodemunchIndexed: true })) as { tool: string }).tool,
      'jcodemunch get_file_tree',
    );
    assert.deepEqual(route('find . -name x', env()), { action: 'allow' });
  });

  it('allows fd and never advises the Glob tool', () => {
    assert.deepEqual(route('fd pattern', env()), { action: 'allow' });
  });
});

describe('block resolutions', () => {
  it('blocks sed -i in every environment', () => {
    const environments = [
      env(),
      env({ rtkAvailable: true }),
      env({ jcodemunchIndexed: true }),
      env({ rtkAvailable: true, jcodemunchIndexed: true }),
    ];
    for (const e of environments) {
      assert.equal(route("sed -i 's/a/b/' f", e).action, 'block');
    }
  });

  it('blocks awk with a redirect', () => {
    assert.equal(route("awk '{print}' in > out", env()).action, 'block');
  });
});

describe('docker is default-allow', () => {
  it('allows docker commands including host-mounting run and exec', () => {
    const commands = [
      'docker ps',
      'docker run -v /:/host alpine sh',
      'docker exec -it app sh',
      'docker-compose up -d',
    ];
    for (const command of commands) {
      assert.deepEqual(route(command, env()), { action: 'allow' });
      assert.deepEqual(
        route(command, env({ rtkAvailable: true, jcodemunchIndexed: true })),
        { action: 'allow' },
      );
    }
  });
});

describe('pass-through', () => {
  it('allows commands no rule names', () => {
    assert.deepEqual(route('ls -la', env()), { action: 'allow' });
  });
});

describe('router sed rule: unanchored, so it over-matches and still has bypasses', () => {
  // String matching is a nudge, not a control. The router rule
  // /\bsed\s+(-i|--in-place)\b/ is unanchored, unlike the classifier.
  it('blocks /usr/bin/sed -i', () => {
    assert.equal(route("/usr/bin/sed -i 's/a/b/' f", env()).action, 'block');
  });

  it('blocks echo sed -i (false positive on harmless text)', () => {
    assert.equal(route('echo sed -i hi', env()).action, 'block');
  });

  it('allows sed -E -i', () => {
    assert.deepEqual(route("sed -E -i 's/a/b/' f", env()), { action: 'allow' });
  });

  it('allows perl -pi', () => {
    assert.deepEqual(route("perl -pi -e 's/a/b/' f", env()), { action: 'allow' });
  });

  it('allows python -c file writes', () => {
    assert.deepEqual(route(`python -c "open('f','w').write('x')"`, env()), { action: 'allow' });
  });

  it('allows runtime-assembled sed -i', () => {
    assert.deepEqual(route("$(echo sed) -i 's/a/b/' f", env()), { action: 'allow' });
    assert.deepEqual(route("S=sed; $S -i 's/a/b/' f", env()), { action: 'allow' });
  });
});

describe('resolve fallbacks', () => {
  it('uses fallback when no general resolution exists, then wildcard, then allow', () => {
    const fallback: Resolution = { action: 'block', reason: 'fb' };
    const wildcard: Resolution = { action: 'block', reason: 'wild' };
    assert.deepEqual(
      resolve({ match: /x/, intent: 'pass_through', resolutions: { fallback, _: wildcard } }, env()),
      fallback,
    );
    assert.deepEqual(
      resolve({ match: /x/, intent: 'pass_through', resolutions: { _: wildcard } }, env()),
      wildcard,
    );
    assert.deepEqual(
      resolve({ match: /x/, intent: 'pass_through', resolutions: {} }, env()),
      { action: 'allow' },
    );
  });
});

describe('formatting helpers', () => {
  it('requiresAction is false only for allow', () => {
    assert.equal(requiresAction({ action: 'allow' }), false);
    assert.equal(requiresAction({ action: 'advise', tool: 't', reason: 'r' }), true);
    assert.equal(requiresAction({ action: 'block', reason: 'r' }), true);
  });

  it('formatResolution renders each action', () => {
    assert.equal(formatResolution({ action: 'allow' }, 'ls'), 'Allowing command: ls');
    assert.equal(
      formatResolution({ action: 'advise', tool: 'Grep tool', reason: 'r' }, 'grep'),
      'Advise: Use "Grep tool" instead. Reason: r',
    );
    assert.equal(formatResolution({ action: 'block', reason: 'no' }, 'x'), 'BLOCKED: no');
  });

  it('formatEnvironment lists detected tools or reports the base environment', () => {
    assert.equal(
      formatEnvironment(env()),
      'Base environment (no optimization tools detected)',
    );
    assert.equal(
      formatEnvironment(env({ rtkAvailable: true, jcodemunchIndexed: true, stackTestActive: true })),
      'RTK available, jcodemunch indexed, stack test active',
    );
  });
});

describe('tools absent by default on macOS, Linux and WSL', () => {
  it('no rule resolution advises the Grep or Glob tool', () => {
    const advised = ROUTING_RULES.flatMap((rule) => Object.values(rule.resolutions))
      .flatMap((res) => (res && res.action === 'advise' ? [res.tool] : []));
    assert.ok(advised.length > 0);
    assert.deepEqual(advised.filter((tool) => /^(Grep|Glob)\b/.test(tool)), []);
  });
});
