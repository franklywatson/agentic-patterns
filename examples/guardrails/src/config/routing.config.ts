/**
 * Routing Configuration
 *
 * Data-driven routing rules that map command patterns to optimal tools.
 * Each rule specifies resolutions for different environments (RTK, jcodemunch, etc.).
 *
 * `grep`, `find` and `fd` advise only an RTK or jcodemunch tool. Claude Code's
 * Grep and Glob tools are absent by default on macOS, Linux and WSL, so no rule
 * advises them: without RTK or an index the command is allowed (Pattern 3.1).
 */

import type { RoutingRule } from '../core/router.js';
import type { Intent } from '../core/intent.js';

/**
 * Routing rules checked in order.
 * First matching rule wins (order matters).
 */
export const ROUTING_RULES: readonly RoutingRule[] = [
  // File modify operations - ALWAYS BLOCK
  {
    match: /\bsed\s+(-i|--in-place)\b/,
    intent: 'file_modify',
    resolutions: {
      _: {
        action: 'block',
        reason: 'sed -i is destructive. Use the Edit tool instead (safer, tracks changes).',
      },
    },
  },
  {
    match: /\bawk\b.*>\s*\S+/,
    intent: 'file_modify',
    resolutions: {
      _: {
        action: 'block',
        reason: 'awk with redirect is destructive. Use the Edit tool instead.',
      },
    },
  },

  // Text search operations
  {
    match: /\b(grep[rx]?|rg)\b/,
    intent: 'text_search',
    resolutions: {
      rtk: {
        action: 'advise',
        tool: 'rtk grep',
        reason: 'structured output, filtered results',
      },
      jcodemunch: {
        action: 'advise',
        tool: 'jcodemunch search_text',
        reason: 'indexed search, faster',
      },
      fallback: {
        action: 'allow',
      },
    },
  },

  // File read operations
  {
    match: /\bcat\s+\S+/,
    intent: 'file_read',
    resolutions: {
      general: {
        action: 'advise',
        tool: 'Read tool',
        reason: 'clean output, no line artifacts',
      },
      fallback: {
        action: 'allow',
      },
    },
  },

  // File discovery operations
  {
    match: /\bfind\s+/,
    intent: 'file_discovery',
    resolutions: {
      jcodemunch: {
        action: 'advise',
        tool: 'jcodemunch get_file_tree',
        reason: 'structured file tree with summaries',
      },
      fallback: {
        action: 'allow',
      },
    },
  },
  {
    match: /\bfd\b/,
    intent: 'file_discovery',
    resolutions: {
      fallback: {
        action: 'allow',
      },
    },
  },

  // Docker operations - default-allow: every docker command passes, including
  // `docker run -v /:/host` and `docker exec`. Docker socket access is
  // root-equivalent, so this rule is not a security control.
  {
    match: /\bdocker(-compose)?\b/,
    intent: 'docker',
    resolutions: {
      _: { action: 'allow' },
    },
  },

  // Default: pass through for unknown commands
  {
    match: /.*/,
    intent: 'pass_through',
    resolutions: {
      _: { action: 'allow' },
    },
  },
] as const;

/**
 * Find the first matching routing rule for a command.
 * Returns null if no rule matches (shouldn't happen with default wildcard).
 */
export function findMatchingRule(command: string): RoutingRule | null {
  for (const rule of ROUTING_RULES) {
    if (rule.match.test(command)) {
      return rule;
    }
  }
  return null;
}

/**
 * Get all rules for a specific intent type.
 */
export function getRulesByIntent(intent: Intent): RoutingRule[] {
  return ROUTING_RULES.filter(rule => rule.intent === intent);
}

/**
 * Get a summary of all configured rules.
 */
export function getRoutingSummary(): string {
  return ROUTING_RULES.map((rule, i) => {
    const intent = rule.intent;
    const actions = Object.entries(rule.resolutions)
      .map(([env, res]) => `${env}=${res.action}`)
      .join(', ');
    return `${i + 1}. [${intent}] ${actions}`;
  }).join('\n');
}
