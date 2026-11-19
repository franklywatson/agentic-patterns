import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ALL_DIMENSIONS, capOf } from "./levels.js";
import { loadRegisterFile, validateRegister } from "./register.js";
import { DAY_MS, ageDays, deletionsSince, isoSeconds, lastChanged, listFiles, parseTime, readJsonIfExists } from "./util.js";
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
  claudeMd: string;
  rulesText: string;
  workflows: string;
  codeowners: string;
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

/** Text that can hold the rules: CLAUDE.md, plus AGENTS.md when CLAUDE.md imports it or CLAUDE.md is absent. */
function rulesTextOf(text: (p: string) => string, exists: (p: string) => boolean): string {
  const claude = text("CLAUDE.md");
  if (!exists("CLAUDE.md") || AGENTS_IMPORT.test(claude)) return `${claude}\n${text("AGENTS.md")}`;
  return claude;
}

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
  const codeowners = ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"].map(text).join("\n");
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
    settings: json(".claude/settings.json"),
    claudeMd: text("CLAUDE.md"),
    rulesText: rulesTextOf(text, (p) => existsSync(join(dir, p))),
    workflows: workflowFiles.map(text).join("\n"),
    codeowners,
    register,
    ledgerNames: existsSync(ledgerDir) ? readdirSync(ledgerDir).filter((n) => n.endsWith(".jsonl")) : [],
    auditLines,
  };
}

const wfs = (c: Ctx): Json[] => c.register?.workflows ?? [];
const sandbox = (c: Ctx): Json => c.settings.sandbox ?? {};
const nonEmptyArray = (v: unknown) => Array.isArray(v) && v.length > 0;

function codeownersSets(c: Ctx): Set<string> {
  const sets = new Set<string>();
  for (const line of c.codeowners.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts[0] && !parts[0].startsWith("#") && parts.length > 1) sets.add(parts.slice(1).sort().join(" "));
  }
  return sets;
}

function rulesetApproves(c: Ctx): boolean {
  return c.files
    .filter((f) => /^\.github\/rulesets\/.+\.json$/.test(f))
    .some((f) => {
      try {
        const rules: Json[] = JSON.parse(c.text(f)).rules ?? [];
        return rules.some(
          (r) => r.type === "pull_request" && (r.parameters?.required_approving_review_count ?? 0) >= 1,
        );
      } catch {
        return false;
      }
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

function baselineFresh(c: Ctx): boolean {
  try {
    const b = JSON.parse(c.text(".autonomy/baseline.json"));
    return b.flow !== undefined && b.stability !== undefined && ageDays(c.now, parseTime(b.captured)) <= FRESH_DAYS;
  } catch {
    return false;
  }
}

function lastReviewFresh(c: Ctx): boolean {
  const lines = c.text(".autonomy/reviews.jsonl").split("\n").filter(Boolean);
  if (lines.length === 0) return false;
  try {
    return ageDays(c.now, parseTime(JSON.parse(lines[lines.length - 1]).ts)) <= FRESH_DAYS;
  } catch {
    return false;
  }
}

export const PROBES: Probe[] = [
  // platform
  { dimension: "platform", level: 2, id: "agent-config", test: (c) => c.exists(".claude") || c.exists(".harness.yaml") || c.exists("AGENTS.md") },
  { dimension: "platform", level: 3, id: "check-command", test: (c) => CHECK_CMD.test(c.claudeMd) && CHECK_CMD.test(c.workflows) },
  { dimension: "platform", level: 3, id: "ci-identity", test: (c) => !/secrets\.[A-Z_]*API_KEY/.test(c.workflows) || /id-token:\s*write/.test(c.workflows) },
  { dimension: "platform", level: 3, id: "sandbox-locked", test: (c) => sandbox(c).enabled === true && sandbox(c).allowUnsandboxedCommands === false },
  { dimension: "platform", level: 4, id: "egress-allowlist", test: (c) => nonEmptyArray(sandbox(c).network?.allowedDomains) },
  { dimension: "platform", level: 4, id: "audit-log", test: (c) => c.auditLines.length > 0 },
  { dimension: "platform", level: 5, id: "versioned-marketplace", test: (c) => Object.keys(c.settings.extraKnownMarketplaces ?? {}).length > 0 },
  { dimension: "platform", level: 5, id: "agents-md", test: (c) => c.exists("AGENTS.md") },
  // shared context
  { dimension: "shared_context", level: 2, id: "claude-md", test: (c) => c.exists("CLAUDE.md") },
  { dimension: "shared_context", level: 3, id: "claude-md-short", test: (c) => c.claudeMd.split("\n").length - (c.claudeMd.endsWith("\n") ? 1 : 0) <= 150 },
  { dimension: "shared_context", level: 3, id: "claude-md-fresh", test: (c) => c.changedWithin("CLAUDE.md", FRESH_DAYS) },
  { dimension: "shared_context", level: 3, id: "claude-md-owner", test: (c) => /^\/?(CLAUDE\.md|\*)\s+\S+/m.test(c.codeowners) },
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
  { dimension: "governance", level: 2, id: "constitutional-rules", test: (c) => /constitutional/i.test(c.rulesText) },
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
  { dimension: "ownership", level: 3, id: "author-trailer", test: (c) => /author-of-record|co-authored-by/i.test(c.claudeMd) || c.exists(".gitmessage") },
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
      const sheet = readJsonIfExists(join(dir, ".autonomy", "worksheets", "skill.json"));
      const fresh = sheet && ageDays(now, parseTime(sheet.date)) <= WORKSHEET_MAX_AGE_DAYS;
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
  profile.cap = capOf(profile);
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

