import { appendFileSync, existsSync, mkdirSync, realpathSync, writeFileSync } from "node:fs";
import { join, relative, resolve, isAbsolute } from "node:path";
import { isGovernanceFile } from "./check.js";
import { allWorkflows, effectiveLevel } from "./levels.js";
import type { Effective } from "./levels.js";
import { loadRegisterFile } from "./register.js";
import { git, insideDir, matchCommand, matchPath, readJsonIfExists, toPosix } from "./util.js";
import type { Json } from "./util.js";

export interface Diff {
  lines: number;
  files: string[];
}

export interface HookContext {
  projectDir: string;
  workflow: Json | null;
  eff: Effective | null;
  untrustedSeen: boolean;
  currentBranch: string | null;
  diff: Diff | null;
}

export interface Decision {
  allow: boolean;
  code?: string;
  reason?: string;
  markUntrusted?: boolean;
}

const READ_TOOLS = new Set(["Read", "Grep", "Glob", "LS", "TodoWrite", "NotebookRead", "Task", "Agent", "Skill", "ToolSearch", "AskUserQuestion", "ExitPlanMode", "EnterPlanMode", "TaskOutput", "TaskStop"]);
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const NETWORK_TOOLS = new Set(["WebFetch", "WebSearch"]);
const READ_ONLY_COMMANDS = new Set(["ls", "cat", "head", "tail", "grep", "rg", "find", "pwd", "echo", "wc", "which", "sort", "diff", "stat"]);
const PROTECTED = new Set(["main", "master"]);
const SECRET_PATH = /(^|\/)\.env(\.|$)|\.ssh\/|\.aws\/|\.npmrc|(^|\/)secrets?(\/|\.)/;

const deny = (code: string, reason: string): Decision => ({ allow: false, code, reason });
const ok: Decision = { allow: true };

export function splitSegments(command: string): string[] {
  return command.split(/&&|\|\||;|\||\n|&/).map((s) => s.trim()).filter(Boolean);
}

function hostsIn(segment: string): string[] {
  const hosts: string[] = [];
  for (const m of segment.matchAll(/https?:\/\/([^/\s:'"]+)/g)) hosts.push(m[1].toLowerCase());
  for (const m of segment.matchAll(/(?:^|\s)(?:\S+@)([A-Za-z0-9.-]+)/g)) hosts.push(m[1].toLowerCase());
  return hosts;
}

function hostAllowed(host: string, allow: string[]): boolean {
  return allow.some((a) => a === "*" || host === a || host.endsWith(`.${a}`));
}

const isEgress = (seg: string) => /^(curl|wget|ssh|scp|nc|ncat|telnet|ftp)\b/.test(seg);
const isPush = (seg: string) => /^git\s+(-\S+\s+)*push\b/.test(seg);
const isMerge = (seg: string) => /^gh\s+pr\s+merge\b/.test(seg) || (/^gh\s+api\b/.test(seg) && /\/merge\b/.test(seg));
const isMergeLabel = (seg: string) => /^gh\s+(pr|issue)\s+(edit|create)\b/.test(seg) && /--(add-)?label[= ]\S*merge/i.test(seg);
const isForce = (seg: string) => /(\s-f\b|--force(-with-lease)?\b|\s\+\S)/.test(seg);

function externalAction(seg: string): boolean {
  if (isPush(seg) || isMerge(seg) || /^(scp|ssh)\b/.test(seg)) return true;
  if (/^(curl|wget)\b/.test(seg) && /(-X\s*(POST|PUT|DELETE|PATCH)|\s-d\b|--data|--upload-file|\s-F\b)/i.test(seg)) return true;
  if (/^gh\s+(issue|pr)\s+comment\b/.test(seg)) return true;
  if (/^gh\s+api\b/.test(seg) && /(-X\s*(POST|PUT|DELETE|PATCH)|--method\s+(POST|PUT|DELETE|PATCH)|\s-f\b|\s-F\b)/.test(seg)) return true;
  return /\bdeploy\b/i.test(seg);
}

function untrustedRead(seg: string): boolean {
  return (
    /^gh\s+issue\s+(view|list)\b/.test(seg) ||
    (/^gh\s+pr\s+view\b/.test(seg) && /--comments/.test(seg)) ||
    (/^gh\s+api\b/.test(seg) && /(issues|comments|pulls)/.test(seg)) ||
    (/^(curl|wget)\b/.test(seg) && !externalAction(seg))
  );
}

function pushTarget(seg: string): string[] {
  const args = seg.replace(/^git\s+(-\S+\s+)*push\b/, "").trim().split(/\s+/).filter((a) => a && !a.startsWith("-"));
  return args.slice(1).map((ref) => ref.replace(/^\+/, "").split(":").pop() as string);
}

function permittedTool(entries: string[], tool: string, subject: string | null, bashSegments: string[] | null): boolean {
  return entries.some((entry) => {
    const m = /^(\w+)(?:\((.*)\))?$/.exec(entry);
    if (!m || m[1] !== tool) return false;
    if (m[2] === undefined) return true;
    if (bashSegments !== null) return bashSegments.every((s) => matchCommand(m[2], s));
    return subject !== null && matchPath(m[2], subject);
  });
}

/** Normalise a tool path against the project directory, resolving `..` and symlinks. */
function normPaths(ctx: HookContext, p: string): { rel: string; real: string } {
  const abs = resolve(ctx.projectDir, p);
  let real = abs;
  try {
    real = realpathSync(abs);
  } catch {
    // the path does not exist yet; the logical path is all there is
  }
  let root = ctx.projectDir;
  try {
    root = realpathSync(ctx.projectDir);
  } catch {
    // fixture project directories need not exist
  }
  return { rel: toPosix(relative(ctx.projectDir, abs)), real: toPosix(relative(root, real)) };
}

const relPath = (ctx: HookContext, p: string) => normPaths(ctx, p).rel;

function governancePath(ctx: HookContext, p: string): boolean {
  const { rel, real } = normPaths(ctx, p);
  return isGovernanceFile(rel) || isGovernanceFile(real);
}

const WRAPPER_OPTIONS = /^git\s+(?:(?:(?:-C|-c|--git-dir|--work-tree|--namespace)(?:\s+|=)\S+|--no-pager|--paginate|--no-optional-locks|-P)\s+)+/;

/** Remove leading assignments, wrappers (env, sudo, time, ...) and git global options. */
export function stripWrappers(segment: string): string {
  let s = segment.trim();
  for (;;) {
    const before = s;
    s = s.replace(/^[A-Za-z_][A-Za-z0-9_]*=\S*\s+/, "");
    s = s.replace(/^(env|command|sudo|time|nohup|nice|exec)\s+(-\S+\s+)*/, "");
    s = s.replace(/^timeout\s+(-\S+\s+)*\d+[smhd]?\s+/, "");
    s = s.replace(WRAPPER_OPTIONS, "git ");
    if (s === before) return s;
  }
}

const INLINE_CODE = [
  /^(sh|bash|zsh|dash|ksh|fish)\s+(?:-\S+\s+)*-\S*c\b/,
  /^eval\b/,
  /^python[0-9.]*\s+(?:-\S+\s+)*-c\b/,
  /^(node|deno|bun)\s+(?:-\S+\s+)*(-e|--eval|-p|--print)\b/,
  /^(perl|ruby|php)\s+(?:-\S+\s+)*-\S*[eEr]\b/,
];

const isInlineCode = (seg: string) => INLINE_CODE.some((re) => re.test(seg));

/** A word at A1: letters, digits and `_ . / : = @ % + , -` only, so the shell cannot expand or redirect it. */
const PLAIN_WORD = /^[A-Za-z0-9_.\/:=@%+,-]+$/;
const A1_GIT_SUBCOMMANDS = new Set(["status", "diff", "log", "show"]);
const A1_GIT_DENIED = /^--(ou|ext|textc)/;
const FIND_WRITES = /^-(delete|exec|execdir|ok|okdir|fprint|fprint0|fprintf|fls)$/;

function readOnlyWords(words: string[]): boolean {
  const [cmd, ...args] = words;
  if (cmd === "git") {
    let i = 0;
    while (args[i] === "--no-pager" || args[i] === "-P") i++;
    return A1_GIT_SUBCOMMANDS.has(args[i]) && !args.slice(i + 1).some((w) => A1_GIT_DENIED.test(w));
  }
  if (!READ_ONLY_COMMANDS.has(cmd)) return false;
  if (cmd === "find") return !args.some((w) => FIND_WRITES.test(w));
  if (cmd === "sort") return !args.some((w) => /^-[^-]*o/.test(w) || /^--(o|co)/.test(w));
  if (cmd === "rg") return !args.some((w) => /^--(pre|hostname-bin)/.test(w));
  return true;
}

/**
 * The A1 rule: one or more commands from the read-only list joined by `|`, every word plain. Quotes, `$`,
 * braces, globs, redirects, `;`, `&`, newlines and backticks are refused before any flag is checked, because
 * the shell can rebuild a write flag from them after the check (`-del$'e'te`, `{-delete,-print}`).
 */
export function plainReadOnly(command: string): boolean {
  const segments = command.split("|").map((s) => s.trim());
  return segments.every((segment) => {
    const words = segment.split(/[ \t]+/);
    return segment !== "" && words.every((w) => PLAIN_WORD.test(w)) && readOnlyWords(words);
  });
}

function toolFile(input: Json): string | null {
  return input.file_path ?? input.notebook_path ?? null;
}

const GOV_WORDS = /\.autonomy|codeowners|\.github\/workflows|\.claude\/(settings|hooks)|\.harness/i;
const WRITE_HINT = new RegExp(
  [
    ">", "\\btee\\b", "\\bsed\\s+-i", "--in-place", "\\bmv\\b", "\\bcp\\b", "\\brm\\b", "\\bln\\b", "\\brsync\\b", "\\btouch\\b",
    "\\btruncate\\b", "\\bdd\\b", "\\binstall\\b", "\\bchmod\\b", "\\bunzip\\b", "--output",
    "\\btar\\s+(?:\\S+\\s+)*?(?:-?[A-Za-z]*x[A-Za-z]*|--extract|--get)(?:\\s|$)",
    "\\bfind\\b.*\\s-(?:delete|exec|execdir|ok|okdir|fprint0?|fprintf|fls)\\b",
    "\\bsort\\b.*\\s-[^-\\s]*o", "git\\s+(checkout|restore|apply|mv|rm)\\b",
  ].join("|"),
);

/** True when a command names a locked or workflow path and a write verb, before or after removing quotes. */
function governanceShellWrite(command: string): boolean {
  const unquoted = command.replace(/["'\\]/g, "");
  return [command, unquoted].some((c) => GOV_WORDS.test(c)) && [command, unquoted].some((c) => WRITE_HINT.test(c));
}

const PR_WRITE = /^gh\s+pr\s+(create|edit|close|reopen|ready|review|comment|lock|unlock|update-branch|revert)\b/;
const API_WRITE = /(-X\s*(POST|PUT|DELETE|PATCH)|--method\s+(POST|PUT|DELETE|PATCH)|\s-f\b|\s-F\b)/;
const isPrWrite = (seg: string) => PR_WRITE.test(seg) || (/^gh\s+api\b/.test(seg) && /\bpulls\b/.test(seg) && API_WRITE.test(seg));

function decideBash(ctx: HookContext, command: string): Decision {
  const wf = ctx.workflow as Json;
  const level = ctx.eff!.effective;
  const segments = splitSegments(command);
  const perm = wf.permitted_actions ?? {};
  const forbidden: string[] = wf.forbidden_actions ?? [];
  if (governanceShellWrite(command)) {
    return deny("governance-write", "shell command writes to a governance file");
  }
  if (Array.isArray(perm.tools)) {
    if (/\$\(|`|<\(|>\(/.test(command)) {
      return deny("outside-permitted-tools", "command substitution cannot be matched against permitted_actions");
    }
    if (!permittedTool(perm.tools, "Bash", null, segments)) {
      return deny("outside-permitted-tools", `Bash command not in permitted_actions.tools: ${command}`);
    }
  }
  if (level <= 1 && !plainReadOnly(command)) {
    return deny("a1-plain-commands-only", `level 1 allows only plain read-only commands joined by |: ${[...READ_ONLY_COMMANDS].join(", ")}, git status|diff|log|show`);
  }
  const network: string[] | undefined = perm.network;
  const restrictEgress = level <= 2 || network !== undefined || level >= 4;
  let mark = false;
  for (const raw of segments) {
    const seg = stripWrappers(raw);
    const explicit = Array.isArray(perm.tools) && perm.tools.some((e: string) => e.startsWith("Bash(") && permittedTool([e], "Bash", null, [raw]));
    if (isInlineCode(seg) && !explicit) {
      return deny("inline-interpreter", "inline shell or interpreter code cannot be inspected; permit it with an explicit Bash(...) pattern");
    }
    if (isPush(seg)) {
      if (isForce(seg)) return deny("force-push", "force push is never permitted");
      if (level <= 2) return deny("git-push-blocked", "git push is blocked below level 3");
      const targets = pushTarget(seg);
      const refs = targets.length > 0 ? targets : ctx.currentBranch === null ? ["main"] : [ctx.currentBranch];
      const headOnProtected = ctx.currentBranch !== null && PROTECTED.has(ctx.currentBranch);
      if (refs.some((r) => PROTECTED.has(r) || (r === "HEAD" && headOnProtected))) {
        return deny("protected-branch-push", "push to a protected branch is blocked");
      }
    }
    if (isMerge(seg) || isMergeLabel(seg)) {
      if (level <= 3) return deny("merge-blocked", "merging and merge-triggering labels are blocked below level 4");
      const mergeDeny = limitsDecision(ctx, wf);
      if (mergeDeny) return mergeDeny;
    }
    if (isPrWrite(seg) && level <= 2) return deny("pr-write-blocked", "opening or changing a pull request is blocked below level 3");
    if (isEgress(seg) && restrictEgress) {
      const hosts = hostsIn(seg);
      const allow = network ?? [];
      if (hosts.length === 0 || !hosts.every((h) => hostAllowed(h, allow))) {
        return deny("network-blocked", `egress outside permitted_actions.network: ${seg}`);
      }
    }
    if (forbidden.includes("deploy") && /\bdeploy\b/i.test(seg)) return deny("forbidden-action", "deploy is forbidden");
    if (forbidden.includes("read_secrets") && SECRET_PATH.test(seg)) return deny("forbidden-action", "read_secrets is forbidden");
    for (const word of forbidden.filter((f) => !["deploy", "read_secrets", "force_push", "edit_ci", "edit_autonomy"].includes(f))) {
      if (new RegExp(`\\b${word}\\b`).test(seg)) return deny("forbidden-action", `${word} is forbidden`);
    }
    if (externalAction(seg) && taintedSession(ctx, wf)) {
      return deny("trifecta-external-action", "session read untrusted input and holds sensitive data; external action needs a named gate");
    }
    if (untrustedRead(seg)) mark = true;
  }
  return mark ? { allow: true, markUntrusted: true } : ok;
}

function taintedSession(ctx: HookContext, wf: Json): boolean {
  return ctx.untrustedSeen && wf.risk?.trifecta?.sensitive_data === true && !wf.risk?.gate;
}

function limitsDecision(ctx: HookContext, wf: Json): Decision | null {
  const perm = wf.permitted_actions ?? {};
  if (!(perm.git ?? []).includes("auto_merge")) return deny("merge-limits", "auto_merge is not in permitted_actions.git");
  if (ctx.diff === null) return deny("merge-limits", "diff size cannot be verified");
  const max = wf.limits?.max_diff_lines;
  if (max !== undefined && ctx.diff.lines > max) return deny("merge-limits", `diff of ${ctx.diff.lines} lines exceeds ${max}`);
  const paths: string[] | undefined = perm.paths;
  if (paths !== undefined) {
    const stray = ctx.diff.files.find((f) => !paths.some((g) => matchPath(g, f)));
    if (stray !== undefined) return deny("merge-limits", `changed file outside permitted paths: ${stray}`);
  }
  return null;
}

export function decide(ctx: HookContext, call: { tool_name: string; tool_input: Json }): Decision {
  const tool = call.tool_name;
  const input = call.tool_input ?? {};
  const file = toolFile(input);
  if (file !== null && WRITE_TOOLS.has(tool) && governancePath(ctx, file)) {
    return deny("governance-write", `agents may not write ${relPath(ctx, file)}`);
  }
  if (ctx.workflow === null || ctx.eff === null) {
    if (READ_TOOLS.has(tool)) return ok;
    return deny("unknown-workflow", "workflow is not in the register; only read-only tools are allowed");
  }
  const wf = ctx.workflow;
  const level = ctx.eff.effective;
  const perm = wf.permitted_actions ?? {};
  if (READ_TOOLS.has(tool)) {
    if (file !== null && (wf.forbidden_actions ?? []).includes("read_secrets") && SECRET_PATH.test(relPath(ctx, file))) {
      return deny("forbidden-action", "read_secrets is forbidden");
    }
    if (Array.isArray(perm.tools) && !permittedTool(perm.tools, tool, file === null ? null : relPath(ctx, file), null)) {
      return deny("outside-permitted-tools", `${tool} is not in permitted_actions.tools`);
    }
    return ok;
  }
  if (WRITE_TOOLS.has(tool)) {
    if (level <= 1) return deny("read-only-level", "level 1 allows read-only tools only");
    if (Array.isArray(perm.tools) && !permittedTool(perm.tools, tool, file === null ? null : relPath(ctx, file), null)) {
      return deny("outside-permitted-tools", `${tool} is not in permitted_actions.tools`);
    }
    if (Array.isArray(perm.paths) && (file === null || !perm.paths.some((g: string) => matchPath(g, relPath(ctx, file))))) {
      return deny("outside-permitted-paths", `${file} is outside permitted_actions.paths`);
    }
    return ok;
  }
  if (NETWORK_TOOLS.has(tool)) {
    const restrict = level <= 2 || perm.network !== undefined || level >= 4;
    if (restrict && tool === "WebFetch") {
      let host = "";
      try {
        host = new URL(input.url).hostname.toLowerCase();
      } catch {
        return deny("network-blocked", "WebFetch url is not parseable");
      }
      if (!hostAllowed(host, perm.network ?? [])) return deny("network-blocked", `${host} is not in permitted_actions.network`);
    } else if (restrict) {
      return deny("network-blocked", `${tool} is blocked: egress is limited to permitted_actions.network`);
    }
    if (Array.isArray(perm.tools) && !permittedTool(perm.tools, tool, null, null)) {
      return deny("outside-permitted-tools", `${tool} is not in permitted_actions.tools`);
    }
    return { allow: true, markUntrusted: true };
  }
  if (tool === "Bash") return decideBash(ctx, String(input.command ?? ""));
  if (Array.isArray(perm.tools)) {
    if (!permittedTool(perm.tools, tool, null, null)) {
      return deny("outside-permitted-tools", `${tool} is not in permitted_actions.tools`);
    }
    return level <= 1 ? deny("read-only-level", "level 1 allows read-only tools only") : ok;
  }
  return deny("unknown-tool", `${tool} is not a recognised tool and permitted_actions.tools does not list it`);
}

export interface Resolved {
  workflow: Json | null;
  eff: Effective | null;
  note: string;
}

export function resolveWorkflow(projectDir: string, workflowId: string, now: number): Resolved {
  const registerPath = join(projectDir, ".autonomy.yaml");
  if (!existsSync(registerPath)) return { workflow: null, eff: null, note: "no .autonomy.yaml; read-only tools only" };
  const register = loadRegisterFile(registerPath);
  const wf = allWorkflows(register).find((w) => w.id === workflowId);
  if (wf === undefined) return { workflow: null, eff: null, note: `workflow ${workflowId} is not in the register; read-only tools only` };
  const profileRel: string = register.profile ?? ".autonomy/profile.json";
  const profile = insideDir(projectDir, profileRel) ? readJsonIfExists(join(projectDir, profileRel)) : null;
  const state = readJsonIfExists(join(projectDir, ".autonomy", "state.json"));
  const eff = effectiveLevel(wf, profile, state, register.defaults, now);
  const why = eff.reasons.length > 0 ? ` (reduced: ${eff.reasons.join(", ")})` : "";
  return { workflow: wf, eff, note: `workflow ${workflowId}: effective level ${eff.effective} of granted ${eff.granted}${why}` };
}

function sessionPath(projectDir: string, session: string): string {
  return join(projectDir, ".autonomy", "sessions", `${session.replace(/[^A-Za-z0-9_-]/g, "_")}.json`);
}

function currentBranch(projectDir: string): string | null {
  return git(projectDir, ["rev-parse", "--abbrev-ref", "HEAD"])?.trim() ?? null;
}

function diffAgainstBase(projectDir: string, base: string): Diff | null {
  const out = git(projectDir, ["diff", "--numstat", base]);
  if (out === null) return null;
  let lines = 0;
  const files: string[] = [];
  for (const row of out.split("\n").filter(Boolean)) {
    const [add, del, name] = row.split("\t");
    lines += (Number(add) || 0) + (Number(del) || 0);
    files.push(name);
  }
  return { lines, files };
}

export interface HookRun {
  stdout: string;
  exitCode: number;
}

export function runHook(event: string, stdin: string, env: Record<string, string | undefined>, now: number): HookRun {
  const input: Json = stdin.trim() === "" ? {} : JSON.parse(stdin);
  if (input === null || typeof input !== "object") throw new Error("hook input must be a JSON object");
  const projectDir = resolve(env.CLAUDE_PROJECT_DIR ?? input.cwd ?? process.cwd());
  const workflowId = env.AUTONOMY_WORKFLOW ?? "interactive";
  const resolved = resolveWorkflow(projectDir, workflowId, now);
  if (event === "session-start") {
    const context = `Autonomy: ${resolved.note}.`;
    return { stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }), exitCode: 0 };
  }
  if (event !== "pre-tool-use") throw new Error(`unknown hook event: ${event}`);
  if (typeof input.tool_name !== "string" || input.tool_name === "" || input.tool_input === null || typeof input.tool_input !== "object") {
    throw new Error("pre-tool-use input needs a string tool_name and an object tool_input");
  }
  const session: string = input.session_id ?? "unknown";
  const spath = sessionPath(projectDir, session);
  const untrustedSeen = readJsonIfExists(spath)?.untrusted_input_seen === true;
  const isMergeCall = input.tool_name === "Bash" && /gh\s+pr\s+merge|gh\s+api\b.*\/merge/.test(String(input.tool_input?.command ?? ""));
  const ctx: HookContext = {
    projectDir,
    workflow: resolved.workflow,
    eff: resolved.eff,
    untrustedSeen,
    currentBranch: currentBranch(projectDir),
    diff: isMergeCall ? diffAgainstBase(projectDir, env.AUTONOMY_BASE ?? "origin/main") : null,
  };
  const decision = decide(ctx, { tool_name: input.tool_name, tool_input: input.tool_input });
  const auditDir = join(projectDir, ".autonomy", "audit");
  mkdirSync(auditDir, { recursive: true });
  appendFileSync(
    join(auditDir, `${session.replace(/[^A-Za-z0-9_-]/g, "_")}.jsonl`),
    `${JSON.stringify({ ts: new Date(now).toISOString(), agent: workflowId, human: env.AUTONOMY_SPONSOR ?? null, tool: input.tool_name, decision: decision.allow ? "allow" : "deny", code: decision.code ?? null })}\n`,
  );
  if (decision.allow && decision.markUntrusted) {
    mkdirSync(join(projectDir, ".autonomy", "sessions"), { recursive: true });
    writeFileSync(spath, JSON.stringify({ untrusted_input_seen: true }));
  }
  if (decision.allow) return { stdout: "", exitCode: 0 };
  return {
    stdout: JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${decision.code}: ${decision.reason}`,
      },
    }),
    exitCode: 0,
  };
}

