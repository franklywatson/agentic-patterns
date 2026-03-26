/**
 * Smart Router
 *
 * Routes commands to optimal tools based on intent and environment.
 * Returns resolutions: allow, advise (use different tool), or block.
 */

import type { Intent } from './intent.js';
import type { Environment } from './environment.js';

/**
 * Routing resolution types
 */
export type Resolution =
  | { action: 'allow' }
  | { action: 'advise'; tool: string; reason: string }
  | { action: 'block'; reason: string };

/**
 * Single routing rule with environment-specific resolutions.
 * The router checks resolutions in priority order.
 */
export interface RoutingRule {
  /** Pattern to match commands ( RegExp ) */
  match: RegExp;
  /** Intent type for this rule */
  intent: Intent;
  /** Resolution per environment/tool */
  resolutions: {
    /** Use RTK if available */
    rtk?: Resolution;
    /** Use jcodemunch if indexed */
    jcodemunch?: Resolution;
    /** General tool (Grep, Read, Glob, etc.) */
    general?: Resolution;
    /** Fallback: allow raw command */
    fallback?: Resolution;
    /** Wildcard: always matches if set */
    _?: Resolution;
  };
}

/**
 * Resolve a routing rule based on environment.
 * Checks resolutions in priority order: rtk → jcodemunch → general → fallback → _
 */
export function resolve(rule: RoutingRule, env: Environment): Resolution {
  const { resolutions } = rule;

  // Priority 1: RTK (token-optimized CLI proxy)
  if (env.rtkAvailable && resolutions.rtk) {
    return resolutions.rtk;
  }

  // Priority 2: jcodemunch (indexed code search)
  if (env.jcodemunchIndexed && resolutions.jcodemunch) {
    return resolutions.jcodemunch;
  }

  // Priority 3: General tool (dedicated Claude Code tool)
  if (resolutions.general) {
    return resolutions.general;
  }

  // Priority 4: Explicit fallback
  if (resolutions.fallback) {
    return resolutions.fallback;
  }

  // Priority 5: Wildcard (default)
  if (resolutions._) {
    return resolutions._;
  }

  // No resolution found: allow by default
  return { action: 'allow' };
}

/**
 * Format a resolution as a human-readable message.
 */
export function formatResolution(resolution: Resolution, command: string): string {
  switch (resolution.action) {
    case 'allow':
      return `Allowing command: ${command}`;
    case 'advise':
      return `Advise: Use "${resolution.tool}" instead. Reason: ${resolution.reason}`;
    case 'block':
      return `BLOCKED: ${resolution.reason}`;
  }
}

/**
 * Check if a resolution requires the agent to change its behavior.
 */
export function requiresAction(resolution: Resolution): boolean {
  return resolution.action !== 'allow';
}

/**
 * Compute token savings estimate for a resolution.
 * Returns percentage (0-100) or null if not applicable.
 */
export function estimateTokenSavings(resolution: Resolution): number | null {
  if (resolution.action === 'allow' || resolution.action === 'block') {
    return null;
  }

  // Estimate savings based on the tool being suggested
  const tool = resolution.tool.toLowerCase();
  if (tool.includes('jcodemunch') || tool.includes('search_symbols')) {
    return 85; // Structured symbol search vs raw grep
  }
  if (tool.includes('grep') && tool.includes('rtk')) {
    return 60; // Filtered grep output
  }
  if (tool.includes('read') && !tool.includes('cat')) {
    return 75; // Clean read vs cat with artifacts
  }
  if (tool.includes('glob') || tool.includes('find')) {
    return 77; // Targeted discovery vs recursive find
  }

  return null;
}
