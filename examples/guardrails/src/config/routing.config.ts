/**
 * Routing Configuration
 *
 * Data-driven routing rules that map command patterns to optimal tools.
 * Each rule specifies resolutions for different environments (RTK, jcodemunch, etc.).
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
        reason: 'structured output, filtered results (~60% token savings)',
      },
      jcodemunch: {
        action: 'advise',
        tool: 'jcodemunch search_text',
        reason: 'indexed search, faster (~80% token savings)',
      },
      general: {
        action: 'advise',
        tool: 'Grep tool',
        reason: 'structured results, no artifacts (~80% token savings)',
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
        reason: 'clean output, no line artifacts (~75% token savings)',
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
        reason: 'structured file tree with summaries (~77% token savings)',
      },
      general: {
        action: 'advise',
        tool: 'Glob tool',
        reason: 'pattern matching, targeted discovery (~77% token savings)',
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
      general: {
        action: 'advise',
        tool: 'Glob tool',
        reason: 'pattern matching, more efficient than fd (~70% token savings)',
      },
      fallback: {
        action: 'allow',
      },
    },
  },

  // Docker operations - pass through (no dedicated tool)
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
