import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ALL_DIMENSIONS, capOf } from "./levels.js";
import { loadRegisterFile, validateRegister } from "./register.js";
import { DAY_MS, ageDays, deletionsSince, git, isoSeconds, lastChanged, listFiles, readJsonIfExists, tryParseTime } from "./util.js";
import type { Json } from "./util.js";

const FRESH_DAYS = 90;
const WORKSHEET_MAX_AGE_DAYS = 90;

interface Ctx {
  dir: string;
  now: number;
  files: string[];
  text(path: string): string;
  exists(path: string): boolean;
  changedWithin(path: string, days: number): boolean;
  settings: Json;
  /** CLAUDE.md, plus AGENTS.md when CLAUDE.md imports it or CLAUDE.md is absent: the files Claude Code loads. */
  instructionFiles: string[];
  instructions: string;
  workflows: string;
  codeowners: string;
  codeownersPath: string | null;
  defaultBranches: string[];
  register: Json | null;
  ledgerNames: string[];
  auditLines: Json[];
}

interface Probe {
  id: string;
  dimension: string;
  level: number;
  test(c: Ctx): boolean;
}

const CHECK_CMD = /\b(npm (run )?(test|check)|pnpm (run )?(test|check)|pytest|make (test|check))\b/;

const AGENTS_IMPORT = /(^|\s)@AGENTS\.md\b/m;

/** CLAUDE.md, plus AGENTS.md when CLAUDE.md imports it with `@AGENTS.md` or CLAUDE.md is absent; existing files only. */
function instructionFilesOf(text: (p: string) => string, exists: (p: string) => boolean): string[] {
  const files = ["CLAUDE.md"];
  if (!exists("CLAUDE.md") || AGENTS_IMPORT.test(text("CLAUDE.md"))) files.push("AGENTS.md");
  return files.filter(exists);
}

/** The branch `origin/HEAD` names, or `main` and `master` when the clone has no `origin/HEAD`. */
function defaultBranchesOf(dir: string): string[] {
  const head = git(dir, ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"])?.trim();
  return head ? [head.slice(head.indexOf("/") + 1)] : ["main", "master"];
}

const lineCount = (text: string) => text.split("\n").length - (text.endsWith("\n") ? 1 : 0);

function build(dir: string, now: number): Ctx {
  const files = listFiles(dir);
  const text = (p: string) => (existsSync(join(dir, p)) ? readFileSync(join(dir, p), "utf8") : "");
  const json = (p: string): Json => {
    try {
      return JSON.parse(text(p));
    } catch {
      return {};
    }
  };
  const workflowFiles = files.filter((f) => /^\.github\/workflows\/.+\.ya?ml$/.test(f));
  // GitHub reads only the first CODEOWNERS it finds, in this order.
  const codeownersPath = [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"].find((p) => existsSync(join(dir, p)));
  const codeowners = codeownersPath === undefined ? "" : text(codeownersPath);
  const instructionFiles = instructionFilesOf(text, (p) => existsSync(join(dir, p)));
  let register: Json | null = null;
  if (existsSync(join(dir, ".autonomy.yaml"))) {
    try {
      register = loadRegisterFile(join(dir, ".autonomy.yaml"));
    } catch {
      register = null;
    }
  }
  const auditDir = join(dir, ".autonomy", "audit");
  const auditLines: Json[] = [];
  if (existsSync(auditDir)) {
    for (const name of readdirSync(auditDir).filter((n) => n.endsWith(".jsonl")).sort()) {
      for (const line of text(`.autonomy/audit/${name}`).split("\n").filter(Boolean)) {
        try {
          auditLines.push(JSON.parse(line));
        } catch {
          // a malformed audit line is not evidence
        }
      }
    }
  }
  const ledgerDir = join(dir, ".autonomy", "ledger");
  return {
    dir,
    now,
    files,
    text,
    exists: (p) => existsSync(join(dir, p)),
    changedWithin(path, days) {
      const t = lastChanged(dir, path);
      return t !== null && ageDays(now, t) <= days;
    },
    settings: ((s: Json) => (isObject(s) ? s : {}))(json(".claude/settings.json")),
    instructionFiles,
    instructions: instructionFiles.map(text).join("\n"),
    workflows: workflowFiles.map(text).join("\n"),
    codeowners,
    codeownersPath: codeownersPath ?? null,
    defaultBranches: defaultBranchesOf(dir),
    register,
    ledgerNames: existsSync(ledgerDir) ? readdirSync(ledgerDir).filter((n) => n.endsWith(".jsonl")) : [],
    auditLines,
  };
}

const wfs = (c: Ctx): Json[] => c.register?.workflows ?? [];
const sandbox = (c: Ctx): Json => c.settings.sandbox ?? {};
const nonEmptyArray = (v: unknown) => Array.isArray(v) && v.length > 0;
const nonEmptyObject = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length > 0;

const isObject = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const OWNER = /^(@[\w.-]+(\/[\w.-]+)?|[^@\s]+@[^@\s]+\.[^@\s]+)$/;

/** CODEOWNERS rules with their valid owners (`@user`, `@org/team` or an email); comments are removed. */
function codeownersRules(c: Ctx): Array<{ pattern: string; owners: string[] }> {
  const rules: Array<{ pattern: string; owners: string[] }> = [];
  for (const line of c.codeowners.split("\n")) {
    const [pattern, ...rest] = line.replace(/(^|\s)#.*$/, "").trim().split(/\s+/);
    const owners = rest.filter((o) => OWNER.test(o));
    if (pattern && owners.length > 0) rules.push({ pattern, owners });
  }
  return rules;
}

function codeownersSets(c: Ctx): Set<string> {
  return new Set(codeownersRules(c).map((r) => [...r.owners].sort().join(" ")));
}

/**
 * True when a CODEOWNERS pattern matches a file path. Gitignore rules as GitHub applies them: a leading or inner
 * `/` anchors the pattern at the root, a trailing `/` matches only a folder's contents, `*` and `?` stay inside
 * one name, `**` crosses folders, and a pattern that names a folder also matches its contents, except one ending
 * in `/*`, which GitHub applies to that folder's own files only.
 */
export function codeownersMatch(pattern: string, path: string): boolean {
  const dirOnly = pattern.endsWith("/");
  const body = pattern.replace(/^\//, "").replace(/\/$/, "");
  if (body === "") return false;
  const anchored = pattern.startsWith("/") || body.includes("/");
  let re = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (body.startsWith("**/", i)) {
      re += "(?:[^/]+/)*";
      i += 2;
    } else if (body.startsWith("/**", i) && i + 3 === body.length) {
      re += "/.*";
      i += 2;
    } else if (ch === "*") {
      re += "[^/]*";
    } else if (ch === "?") {
      re += "[^/]";
    } else {
      re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  const tail = dirOnly ? "/.*" : body.endsWith("/*") ? "" : "(?:/.*)?";
  return new RegExp(`^${anchored ? "" : "(?:[^/]+/)*"}${re}${tail}$`).test(path);
}

/** Paths a high-tier change touches: CI, Claude Code configuration, the register and CODEOWNERS itself. */
const HIGH_TIER_SAMPLES = [".github/workflows/ci.yml", ".github/actions/setup/action.yml", ".claude/settings.json", ".claude/hooks/guard.sh", ".autonomy.yaml", ".autonomy/profile.json"];

/** Every high-tier sample path, and the CODEOWNERS file itself, has an owner: the last matching rule names one. */
function codeownersCoverHighTier(c: Ctx): boolean {
  const lines = c.codeowners.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "").trim().split(/\s+/)).filter((p) => p[0] !== "");
  const owned = (path: string) => {
    const rule = [...lines].reverse().find((p) => codeownersMatch(p[0], path));
    return rule !== undefined && rule.slice(1).some((o) => OWNER.test(o));
  };
  return c.codeownersPath !== null && [...HIGH_TIER_SAMPLES, c.codeownersPath].every(owned);
}

/** A ref_name pattern list names the default branch: `~DEFAULT_BRANCH`, `refs/heads/<name>` or `<name>`. */
function namesDefault(c: Ctx, list: unknown): boolean {
  return Array.isArray(list) && list.some((p) => p === "~DEFAULT_BRANCH" || c.defaultBranches.some((b) => p === b || p === `refs/heads/${b}`));
}

/** An absent value or an empty list; anything else (a non-empty list, null, an object) is not empty. */
const emptyOrAbsent = (v: unknown) => v === undefined || (Array.isArray(v) && v.length === 0);

/**
 * A committed ruleset that is enforced (`enforcement: "active"`) on the default branch, with no bypass actors and
 * no excluded branches, requires a non-author approval: on every pull request (an integer
 * `required_approving_review_count` of at least 1), or on pull requests that change a file with a code owner
 * (`require_code_owner_review: true` and a CODEOWNERS whose rules give an owner to every high-tier path). The probe
 * reads the committed file's shape; it does not show that GitHub enforces the ruleset.
 */
function rulesetApproves(c: Ctx): boolean {
  const ruleApproves = (r: Json): boolean => {
    if (!isObject(r) || r.type !== "pull_request" || !isObject(r.parameters)) return false;
    const count = r.parameters.required_approving_review_count;
    if (Number.isInteger(count) && count >= 1) return true;
    return r.parameters.require_code_owner_review === true && codeownersCoverHighTier(c);
  };
  return c.files
    .filter((f) => /^\.github\/rulesets\/.+\.json$/.test(f))
    .some((f) => {
      let rs: Json;
      try {
        rs = JSON.parse(c.text(f));
      } catch {
        return false;
      }
      if (!isObject(rs) || rs.enforcement !== "active" || (rs.target !== undefined && rs.target !== "branch")) return false;
      if (!emptyOrAbsent(rs.bypass_actors)) return false;
      const ref = isObject(rs.conditions) ? rs.conditions.ref_name : undefined;
      if (!isObject(ref) || !namesDefault(c, ref.include) || !emptyOrAbsent(ref.exclude)) return false;
      return Array.isArray(rs.rules) && rs.rules.some(ruleApproves);
    });
}

function pinsValid(c: Ctx): boolean {
  try {
    const pins: Json[] = JSON.parse(c.text(".claude/pins.json")).pins ?? [];
    return pins.length > 0 && pins.every((p) => /^[0-9a-f]{64}$/.test(p.sha256 ?? ""));
  } catch {
    return false;
  }
}

const hasFiniteNumber = (v: unknown) => isObject(v) && Object.values(v).some((x) => typeof x === "number" && Number.isFinite(x));

/** A date the census accepts as evidence: an ISO date or time, not later than now, within `days`. */
function recent(c: Ctx, value: unknown, days: number): boolean {
  const t = tryParseTime(value);
  return t !== null && t <= c.now && ageDays(c.now, t) <= days;
}

function baselineFresh(c: Ctx): boolean {
  let b: Json;
  try {
    b = JSON.parse(c.text(".autonomy/baseline.json"));
  } catch {
    return false;
  }
  return isObject(b) && hasFiniteNumber(b.flow) && hasFiniteNumber(b.stability) && recent(c, b.captured, FRESH_DAYS);
}

function lastReviewFresh(c: Ctx): boolean {
  const lines = c.text(".autonomy/reviews.jsonl").split("\n").filter(Boolean);
  if (lines.length === 0) return false;
  try {
    return recent(c, JSON.parse(lines[lines.length - 1]).ts, FRESH_DAYS);
  } catch {
    return false;
  }
}

/** Latest commit time across the instruction files, so a maintained AGENTS.md keeps a one-line CLAUDE.md fresh. */
function instructionsFresh(c: Ctx): boolean {
  return c.instructionFiles.some((f) => c.changedWithin(f, FRESH_DAYS));
}

const INSTRUCTION_LINE_LIMIT = 200;

export const PROBES: Probe[] = [
  // platform
  { dimension: "platform", level: 2, id: "agent-config", test: (c) => c.exists(".claude") || c.exists(".harness.yaml") || c.exists("AGENTS.md") },
  { dimension: "platform", level: 3, id: "check-command", test: (c) => CHECK_CMD.test(c.instructions) && CHECK_CMD.test(c.workflows) },
  { dimension: "platform", level: 3, id: "ci-identity", test: (c) => !/secrets\.[A-Z_]*API_KEY/.test(c.workflows) || /id-token:\s*write/.test(c.workflows) },
  { dimension: "platform", level: 3, id: "sandbox-locked", test: (c) => sandbox(c).enabled === true && sandbox(c).allowUnsandboxedCommands === false },
  { dimension: "platform", level: 4, id: "egress-allowlist", test: (c) => nonEmptyArray(sandbox(c).network?.allowedDomains) },
  { dimension: "platform", level: 4, id: "audit-log", test: (c) => c.auditLines.length > 0 },
  { dimension: "platform", level: 5, id: "versioned-marketplace", test: (c) => Object.keys(c.settings.extraKnownMarketplaces ?? {}).length > 0 },
  { dimension: "platform", level: 5, id: "agents-md", test: (c) => c.exists("AGENTS.md") },
  // shared context
  { dimension: "shared_context", level: 2, id: "claude-md", test: (c) => c.exists("CLAUDE.md") },
  {
    dimension: "shared_context", level: 3, id: "claude-md-short",
    test: (c) => c.instructionFiles.reduce((n, f) => n + lineCount(c.text(f)), 0) <= INSTRUCTION_LINE_LIMIT,
  },
  { dimension: "shared_context", level: 3, id: "claude-md-fresh", test: instructionsFresh },
  { dimension: "shared_context", level: 3, id: "claude-md-owner", test: (c) => codeownersRules(c).some((r) => ["CLAUDE.md", "/CLAUDE.md", "*"].includes(r.pattern)) },
  {
    dimension: "shared_context", level: 3, id: "decision-log",
    test: (c) => c.files.some((f) => /^docs\/(solutions|adr|adrs|decisions)\//.test(f) && c.changedWithin(f, FRESH_DAYS)),
  },
  {
    dimension: "shared_context", level: 3, id: "blocking-hook-tested",
    test: (c) => nonEmptyArray(c.settings.hooks?.PreToolUse) && c.files.some((f) => /hook.*test|test.*hook/i.test(f)),
  },
  { dimension: "shared_context", level: 5, id: "docs-pruned", test: (c) => deletionsSince(c.dir, "docs", c.now - FRESH_DAYS * DAY_MS) > 0 },
  // operating model
  { dimension: "operating_model", level: 2, id: "ci-tests-lint", test: (c) => /\btest\b/i.test(c.workflows) && /\blint\b/i.test(c.workflows) },
  { dimension: "operating_model", level: 3, id: "ci-on-pr", test: (c) => /pull_request/.test(c.workflows) },
  { dimension: "operating_model", level: 3, id: "automated-review", test: (c) => /anthropics\/claude-code-action|claude-code-review|code-review/i.test(c.workflows) },
  { dimension: "operating_model", level: 3, id: "skill-chain", test: (c) => c.exists(".harness.yaml") || c.files.some((f) => f.startsWith(".claude/skills/")) },
  { dimension: "operating_model", level: 4, id: "review-tiers", test: (c) => c.exists("REVIEW.md") || codeownersSets(c).size >= 2 },
  { dimension: "operating_model", level: 5, id: "retired-rules-recorded", test: (c) => c.exists("docs/retired.md") },
  // governance
  { dimension: "governance", level: 2, id: "constitutional-rules", test: (c) => /constitutional/i.test(c.instructions) },
  { dimension: "governance", level: 3, id: "sandbox-locked", test: (c) => sandbox(c).enabled === true && sandbox(c).allowUnsandboxedCommands === false },
  { dimension: "governance", level: 3, id: "deny-rules", test: (c) => nonEmptyArray(c.settings.permissions?.deny) },
  { dimension: "governance", level: 3, id: "extensions-pinned", test: pinsValid },
  { dimension: "governance", level: 3, id: "non-author-approval", test: rulesetApproves },
  { dimension: "governance", level: 3, id: "secret-scanning", test: (c) => /gitleaks|trufflehog|secret-scanning/i.test(c.workflows) || c.exists(".github/secret_scanning.yml") },
  {
    dimension: "governance", level: 4, id: "trifecta-classified",
    test: (c) => wfs(c).length > 0 && wfs(c).every((w) => {
      const t = w.risk?.trifecta;
      if (!t) return false;
      return !(t.untrusted_input && t.sensitive_data && t.external_action) || Boolean(w.risk.gate);
    }),
  },
  { dimension: "governance", level: 4, id: "audit-names-agent", test: (c) => c.auditLines.some((l) => Boolean(l.agent) && Boolean(l.human)) },
  { dimension: "governance", level: 5, id: "review-record", test: lastReviewFresh },
  { dimension: "governance", level: 5, id: "stop-drills-recorded", test: (c) => wfs(c).some((w) => w.granted_level >= 4) && wfs(c).filter((w) => w.granted_level >= 4).every((w) => w.stop?.last_tested !== undefined) },
  // ownership
  { dimension: "ownership", level: 2, id: "register-owners", test: (c) => wfs(c).length > 0 && wfs(c).every((w) => typeof w.owner === "string" && w.owner !== "") },
  { dimension: "ownership", level: 3, id: "owners-in-codeowners", test: (c) => wfs(c).length > 0 && wfs(c).every((w) => c.codeowners.includes(w.owner)) },
  { dimension: "ownership", level: 3, id: "sponsors-and-expiry", test: (c) => wfs(c).length > 0 && wfs(c).every((w) => w.sponsor && (w.granted_level < 4 || w.access_expires)) },
  { dimension: "ownership", level: 3, id: "author-trailer", test: (c) => /author-of-record|co-authored-by/i.test(c.instructions) || c.exists(".gitmessage") },
  { dimension: "ownership", level: 4, id: "harness-eval-in-ci", test: (c) => /\.claude\/\*\*/.test(c.workflows) },
  { dimension: "ownership", level: 4, id: "stop-authority", test: (c) => wfs(c).filter((w) => w.granted_level >= 3).every((w) => w.stop?.mechanism && nonEmptyArray(w.stop?.authority)) && wfs(c).some((w) => w.granted_level >= 3) },
  { dimension: "ownership", level: 5, id: "retirements-recorded", test: (c) => c.exists(".autonomy/retirements.jsonl") },
  // measuring
  { dimension: "measuring", level: 2, id: "outcome-tracking", test: (c) => c.ledgerNames.length > 0 || c.exists(".autonomy/baseline.json") },
  { dimension: "measuring", level: 3, id: "baseline", test: baselineFresh },
  {
    dimension: "measuring", level: 4, id: "task-banks",
    test: (c) => {
      const banks = wfs(c).map((w) => w.verification?.task_bank).filter(Boolean);
      return banks.length > 0 && banks.every((b: string) => c.exists(b));
    },
  },
  {
    dimension: "measuring", level: 5, id: "per-workflow-targets",
    test: (c) => wfs(c).length > 0 && wfs(c).every((w) => w.baseline && w.target && w.review_date && w.stop_rule),
  },
];

const WORKSHEET_ITEMS = [
  { dimension: "skill", step: "work-sample", instruction: "Run a supervised work sample with each regular agent user and score review quality from 1 to 5." },
  { dimension: "skill", step: "perception-survey", instruction: "Run the perception survey last, after the work sample, so it does not bias the sample." },
  { dimension: "operating_model", step: "merge-sample", instruction: "Sample 10 merged agent PRs and record the share changed after human review." },
  { dimension: "shared_context", step: "governed-connectors", instruction: "Confirm that organisation-level connectors are governed outside this repository." },
];

export interface CensusResult {
  profile: Json;
  worksheet: Json;
}

export function runCensus(dirArg: string, now: number): CensusResult {
  const dir = resolve(dirArg);
  const ctx = build(dir, now);
  const dimensions: Json = {};
  for (const dimension of ALL_DIMENSIONS) {
    if (dimension === "skill") {
      let sheet: Json = null;
      try {
        sheet = readJsonIfExists(join(dir, ".autonomy", "worksheets", "skill.json"));
      } catch {
        sheet = null;
      }
      const fresh = isObject(sheet) && recent(ctx, sheet.date, WORKSHEET_MAX_AGE_DAYS);
      dimensions.skill = fresh && Number.isInteger(sheet.level) && sheet.level >= 1 && sheet.level <= 5
        ? { level: sheet.level, evidence: ["worksheet:skill"], missing_for_next: [] }
        : { level: "unknown", counted_as: 2, evidence: [], missing_for_next: ["worksheet:skill"] };
      continue;
    }
    const probes = PROBES.filter((p) => p.dimension === dimension);
    let level = 1;
    for (let next = 2; next <= 5; next++) {
      const group = probes.filter((p) => p.level === next);
      if (group.length === 0 || !group.every((p) => p.test(ctx))) break;
      level = next;
    }
    const evidence = probes.filter((p) => p.level <= level && p.test(ctx)).map((p) => p.id);
    const nextGroup = probes.filter((p) => p.level === level + 1);
    let missing: string[] = [];
    if (level < 5) {
      missing = nextGroup.length === 0 ? [`human-only:c${level + 1}`] : nextGroup.filter((p) => !p.test(ctx)).map((p) => p.id);
    }
    dimensions[dimension] = { level, evidence: [...new Set(evidence)], missing_for_next: missing };
  }
  const profile: Json = { generated: isoSeconds(now), dimensions, cap: 0, workflows_over_cap: [] as string[] };
  profile.cap = capOf(profile, now);
  if (ctx.register !== null && validateRegister(ctx.register).length === 0) {
    profile.workflows_over_cap = ctx.register.workflows.filter((w: Json) => w.granted_level > profile.cap).map((w: Json) => w.id);
  }
  const worksheet = { generated: isoSeconds(now), items: WORKSHEET_ITEMS.map((i) => ({ ...i, record_to: `.autonomy/worksheets/${i.dimension}.json` })) };
  return { profile, worksheet };
}

export function writeCensus(dirArg: string, result: CensusResult): string {
  const out = join(resolve(dirArg), ".autonomy");
  mkdirSync(out, { recursive: true });
  const path = join(out, "profile.json");
  writeFileSync(path, `${JSON.stringify(result.profile, null, 2)}\n`);
  writeFileSync(join(out, "worksheet.json"), `${JSON.stringify(result.worksheet, null, 2)}\n`);
  return path;
}

