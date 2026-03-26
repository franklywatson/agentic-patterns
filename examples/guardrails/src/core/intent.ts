/**
 * Intent Classification
 *
 * Parses bash commands into intent categories to enable smart routing.
 * Supports compound commands (&&, ||, ;, |) with precedence-based matching.
 */

/**
 * Primary intent types for bash commands
 */
export type Intent =
  | 'file_read'      // Reading file contents: cat, head, tail
  | 'text_search'    // Searching text content: grep, rg, grepr
  | 'file_discovery' // Finding files by name/pattern: find, fd
  | 'file_modify'    // Destructive file edits: sed -i, awk with redirects
  | 'docker'         // Container operations: docker, docker-compose
  | 'pass_through';  // Unknown/benign commands: ls, pwd, echo

/**
 * Pattern to intent mapping, ordered by precedence.
 * IMPORTANT: sed -i must match BEFORE generic text patterns.
 */
interface IntentMatch {
  pattern: RegExp;
  type: Intent;
}

/**
 * Intent patterns checked in order.
 * Precedence matters: more specific patterns must come first.
 */
export const INTENT_PATTERNS: readonly IntentMatch[] = [
  // Destructive patterns MUST be first
  { pattern: /^\s*sed\s+(-i|--in-place)\b/, type: 'file_modify' },
  { pattern: /^\s*awk\b.*>\s*\S+/, type: 'file_modify' },

  // File read operations
  { pattern: /^\s*cat\s+\S+/, type: 'file_read' },
  { pattern: /^\s*head\s+/, type: 'file_read' },
  { pattern: /^\s*tail\s+/, type: 'file_read' },

  // Text search operations
  { pattern: /^\s*(grep[rx]?|rg)\b/, type: 'text_search' },

  // File discovery operations
  { pattern: /^\s*find\s+/, type: 'file_discovery' },
  { pattern: /^\s*fd\b/, type: 'file_discovery' },

  // Docker operations
  { pattern: /^\s*docker(-compose)?\b/, type: 'docker' },
] as const;

/**
 * Split compound commands into segments.
 * Handles: && (and), || (or), ; (sequential), | (pipe)
 */
function splitCompoundCommand(command: string): string[] {
  return command
    .split(/&&|\|\||;|\|/)
    .map(s => s.trim())
    .filter(Boolean);
}

/**
 * Classify a single command segment into its intent.
 * Returns the first matching pattern (precedence order).
 */
function classifySegment(segment: string): Intent {
  for (const { pattern, type } of INTENT_PATTERNS) {
    if (pattern.test(segment)) {
      return type;
    }
  }
  return 'pass_through';
}

/**
 * Classify a command (possibly compound) into intents.
 * Each segment is classified independently.
 *
 * @example
 * ```ts
 * classifyCommand("cat file.txt && grep pattern file.txt")
 * // Returns: ["file_read", "text_search"]
 *
 * classifyCommand("sed -i 's/old/new/g' file.txt")
 * // Returns: ["file_modify"] - BLOCK THIS
 * ```
 */
export function classifyCommand(command: string): Intent[] {
  const segments = splitCompoundCommand(command);
  return segments.map(classifySegment);
}

/**
 * Check if a command contains any dangerous intents.
 * Dangerous intents should be blocked or routed to safer tools.
 */
export function isDangerous(intent: Intent): boolean {
  return intent === 'file_modify';
}

/**
 * Check if a command has a safer tool alternative.
 */
export function hasSaferAlternative(intent: Intent): boolean {
  return ['file_read', 'text_search', 'file_discovery'].includes(intent);
}

/**
 * Human-readable description of each intent type.
 */
export const INTENT_DESCRIPTIONS: Record<Intent, string> = {
  file_read: 'Reading file contents',
  text_search: 'Searching text content',
  file_discovery: 'Finding files by name/pattern',
  file_modify: 'Destructive file edits',
  docker: 'Container operations',
  pass_through: 'Pass-through (unknown/benign)',
} as const;
