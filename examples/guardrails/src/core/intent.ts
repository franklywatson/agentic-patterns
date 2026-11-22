/**
 * Intent Classification
 *
 * Parses bash commands into intent categories to enable smart routing.
 * Splits compound commands on unquoted `&&`, `||`, `;` and `|` with a
 * quote- and escape-aware scanner, so separators inside quotes or after a
 * backslash stay data. A segment that follows a `|` filters upstream output:
 * advisory intents there are dropped, writes are still checked.
 */

/**
 * Primary intent types for bash commands
 */
export type Intent =
  | 'file_read'      // Reading file contents: cat, head, tail
  | 'text_search'    // Searching text content: grep, rg, grepr
  | 'file_discovery' // Finding files by name/pattern: find, fd
  | 'file_modify'    // Destructive file edits: sed -i, redirects to a file
  | 'docker'         // Container operations: docker, docker-compose
  | 'pass_through';  // Unknown/benign commands: ls, pwd, echo

/**
 * One rule in the intent table. A rule matches by anchored regex or by
 * predicate, for rules a regex cannot express (redirect detection).
 */
export interface IntentMatch {
  /** Regex anchored at the start of the segment */
  pattern?: RegExp;
  /** Predicate for rules that need quote-aware scanning */
  predicate?: (segment: string) => boolean;
  /** Intent emitted when the rule matches */
  type: Intent;
}

/**
 * Intent rules checked in order.
 * Precedence matters: destructive rules must come first, so `sed -i` is
 * never classified as a text search and a redirect is never hidden by a
 * read rule.
 */
export const INTENT_PATTERNS: readonly IntentMatch[] = [
  // Destructive patterns MUST be first
  { pattern: /^\s*sed\s+(-i|--in-place)\b/, type: 'file_modify' },
  { predicate: hasFileRedirect, type: 'file_modify' },

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
 * One command between two separators, with the separator that started it.
 */
export interface CommandSegment {
  /** The segment text, trimmed, quotes kept */
  text: string;
  /** True when the segment follows a `|`: it filters upstream output */
  viaPipe: boolean;
}

/**
 * Quote- and escape-state scanner shared by the splitter and the redirect
 * detector, so both agree on which characters are data and which are syntax.
 * Inside single quotes every character is data. Inside double quotes a
 * backslash escapes the next character. Outside quotes a backslash escapes
 * the next character.
 */
class ShellScan {
  private quote: "'" | '"' | null = null;
  private escaped = false;

  /**
   * Feed one character. Returns true when the character is plain syntax
   * (outside quotes, not escaped); the caller may then treat it as an
   * operator.
   */
  feed(ch: string): boolean {
    if (this.escaped) {
      this.escaped = false;
      return false;
    }
    if (this.quote) {
      if (this.quote === '"' && ch === '\\') this.escaped = true;
      else if (ch === this.quote) this.quote = null;
      return false;
    }
    switch (ch) {
      case '\\':
        this.escaped = true;
        return false;
      case "'":
      case '"':
        this.quote = ch;
        return false;
      default:
        return true;
    }
  }
}

/**
 * Split a compound command on unquoted `&&`, `||`, `;` and `|`.
 * Separators inside quotes or after a backslash are data. A single `&`
 * (background operator) is not a separator. Empty segments are dropped.
 */
export function splitCompoundCommand(command: string): CommandSegment[] {
  const segments: CommandSegment[] = [];
  const scan = new ShellScan();
  let current = '';
  // Whether the segment being built follows a `|`
  let viaPipe = false;

  const flush = (pipeNext: boolean): void => {
    const text = current.trim();
    if (text) segments.push({ text, viaPipe });
    current = '';
    viaPipe = pipeNext;
  };

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];
    if (!scan.feed(ch)) {
      current += ch;
      continue;
    }
    if (ch === ';') {
      flush(false);
      continue;
    }
    if (ch === '|') {
      const doubled = command[i + 1] === '|';
      if (doubled) i++;
      // `|` continues a pipeline; `||` starts a new command
      flush(!doubled);
      continue;
    }
    if (ch === '&' && command[i + 1] === '&') {
      i++;
      flush(false);
      continue;
    }
    current += ch;
  }
  flush(false);
  return segments;
}

/**
 * True when the segment contains a plain `>` or `>>` redirect that writes a
 * file. Quote-aware: a quoted `>` is data. Excludes fd duplication
 * (`2>&1`, `>&2`, `2>&-`), the `/dev/null` sink and process substitution
 * (`>(cmd)`), none of which create or modify a regular file.
 */
export function hasFileRedirect(segment: string): boolean {
  const scan = new ShellScan();
  for (let i = 0; i < segment.length; i++) {
    const ch = segment[i];
    if (!scan.feed(ch)) continue;
    if (ch !== '>') continue;
    // A run of '>' forms '>>' (append); both write a file
    let j = i + 1;
    while (j < segment.length && segment[j] === '>') j++;
    // fd duplication like 2>&1 or >&2: '&' then a digit or '-' writes no file
    if (segment[j] === '&') {
      const after = segment[j + 1];
      if (after !== undefined && (isDigit(after) || after === '-')) {
        i = j;
        continue;
      }
      // '>&file' redirects both streams to a file
      return true;
    }
    // The target word starts after optional spaces
    let k = j;
    while (k < segment.length && segment[k] === ' ') k++;
    if (k >= segment.length) {
      i = j - 1; // bare '>' with no target: nothing to write to
      continue;
    }
    if (segment[k] === '(') {
      i = k; // process substitution >(cmd) runs a command, writes no file
      continue;
    }
    if (segment.startsWith(DEV_NULL, k) && isBoundary(segment[k + DEV_NULL.length])) {
      i = k + DEV_NULL.length - 1; // the /dev/null sink
      continue;
    }
    return true;
  }
  return false;
}

const DEV_NULL = '/dev/null';

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isBoundary(ch: string | undefined): boolean {
  return ch === undefined || ch === ' ' || ch === '\t';
}

/**
 * Classify a single command segment into its intent.
 * Returns the first matching rule (precedence order).
 */
function classifySegment(segment: string): Intent {
  for (const { pattern, predicate, type } of INTENT_PATTERNS) {
    if (pattern) {
      if (pattern.test(segment)) return type;
    } else if (predicate) {
      if (predicate(segment)) return type;
    }
  }
  return 'pass_through';
}

/**
 * Advisory intents that do not touch files when the input is piped output:
 * after a `|`, grep filters text, cat and find would read the pipe, not
 * files. Writes after a pipe still write, so file_modify is never dropped.
 */
const PIPE_FILTERED: ReadonlySet<Intent> = new Set([
  'file_read',
  'text_search',
  'file_discovery',
]);

/**
 * Classify a command (possibly compound) into intents.
 * Each segment is classified independently; advisory intents in pipeline
 * members are dropped (they filter upstream output), writes are kept.
 *
 * @example
 * ```ts
 * classifyCommand("cat file.txt && grep pattern file.txt")
 * // Returns: ["file_read", "text_search"]
 *
 * classifyCommand('git log | grep fix')
 * // Returns: ["pass_through"] - the grep filters output, not files
 *
 * classifyCommand("sed -i 's/old/new/g' file.txt")
 * // Returns: ["file_modify"] - BLOCK THIS
 * ```
 */
export function classifyCommand(command: string): Intent[] {
  return splitCompoundCommand(command).flatMap(({ text, viaPipe }) => {
    const intent = classifySegment(text);
    if (viaPipe && PIPE_FILTERED.has(intent)) return [];
    return [intent];
  });
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
