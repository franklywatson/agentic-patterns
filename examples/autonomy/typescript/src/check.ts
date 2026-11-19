import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { allWorkflows, effectiveLevel, capOf, profileStatus } from "./levels.js";
import type { Effective } from "./levels.js";
import { loadRegisterFile, validateRegister } from "./register.js";
import { ageDays, git, insideDir, parseTime, readJsonIfExists } from "./util.js";
import type { Json } from "./util.js";

export interface Failure {
  code: string;
  workflow?: string;
  path?: string;
  keyword?: string;
  granted?: number;
  cap?: number;
  commit?: string;
  file?: string;
}

export interface Acknowledged {
  commit: string;
  file: string;
  by: string;
}

export interface CheckResult {
  ok: boolean;
  cap: number | null;
  profile_age_days: number | null;
  workflows: Array<{ id: string; granted: number; effective: number; reasons: string[] }>;
  acknowledged: Acknowledged[];
  failures: Failure[];
}

export interface Commit {
  sha: string;
  author: string;
  email: string;
  body?: string;
  files: string[];
}

// Tier 1: never changed by an agent commit, no relief.
const TIER1 = [/^\.autonomy/, /(^|\/)codeowners$/, /^\.claude\/settings[^/]*\.json$/, /^\.claude\/hooks\//, /^\.harness\.yaml$/];
// Tier 2: changed by an agent commit only when a later non-agent commit acknowledges it.
const TIER2 = [/^\.github\/workflows\//];

export function isTier1File(path: string): boolean {
  const lower = path.toLowerCase();
  return TIER1.some((re) => re.test(lower));
}

export function isTier2File(path: string): boolean {
  const lower = path.toLowerCase();
  return !isTier1File(path) && TIER2.some((re) => re.test(lower));
}

export function isGovernanceFile(path: string): boolean {
  return isTier1File(path) || isTier2File(path);
}

const ACK_LINE = /^governance-approved:[ \t]*([0-9a-f]{7,40})[ \t]*\r?$/gim;

/** Hex prefixes named by `Governance-Approved: <sha>` lines in a commit message body. */
export function approvedPrefixes(body: string | undefined): string[] {
  return [...(body ?? "").matchAll(ACK_LINE)].map((m) => m[1].toLowerCase());
}

export function agentTokens(register: Json): string[] {
  return (register.workflows ?? [])
    .map((w: Json) => String(w.identity ?? ""))
    .filter((id: string) => id.includes(":") && !id.startsWith("person:"))
    .map((id: string) => id.slice(id.indexOf(":") + 1).toLowerCase());
}

export function isAgentCommit(commit: Commit, tokens: string[]): boolean {
  const who = `${commit.author} ${commit.email}`.toLowerCase();
  if (who.includes("[bot]")) return true;
  if (tokens.some((t) => who.includes(t))) return true;
  return /^co-authored-by:\s*claude/im.test(commit.body ?? "");
}

const RANGE = /^[\w./^~@{:+][\w./^~@{}:+-]*(\.\.\.?[\w./^~@{}:+-]+)?$/;

export function commitsFromGit(dir: string, range: string): Commit[] {
  if (!RANGE.test(range)) throw new Error(`invalid git range: ${range}`);
  const out = git(dir, ["log", "--no-renames", "--name-only", "--format=%x1e%H%x1f%an%x1f%ae%x1f%B%x1d", range]);
  if (out === null) throw new Error(`git log failed for range ${range}`);
  const commits: Commit[] = [];
  for (const chunk of out.split("\x1e").filter((c) => c.trim() !== "")) {
    const [head, filesText] = chunk.split("\x1d");
    const [sha, author, email, ...body] = head.split("\x1f");
    commits.push({ sha, author, email, body: body.join("\x1f"), files: filesText.split("\n").filter(Boolean) });
  }
  return commits.reverse();
}

export interface CheckOptions {
  dir: string;
  registerPath?: string;
  now: number;
  commits?: Commit[];
}

export function runCheck(opts: CheckOptions): CheckResult {
  const dir = resolve(opts.dir);
  const registerPath = opts.registerPath ?? join(dir, ".autonomy.yaml");
  const result: CheckResult = { ok: true, cap: null, profile_age_days: null, workflows: [], acknowledged: [], failures: [] };
  const register = loadRegisterFile(registerPath);
  const schemaErrors = validateRegister(register);
  for (const e of schemaErrors) result.failures.push({ code: "schema", path: e.path, keyword: e.keyword });
  if (schemaErrors.length > 0) {
    result.ok = false;
    return result;
  }
  const profileRel: string = register.profile ?? ".autonomy/profile.json";
  if (!insideDir(dir, profileRel)) throw new Error(`profile path escapes the repository: ${profileRel}`);
  const profilePath = join(dir, profileRel);
  const profile: Json | null = existsSync(profilePath) ? readJsonIfExists(profilePath) : null;
  const state = readJsonIfExists(join(dir, ".autonomy", "state.json"));
  const status = profileStatus(profile, opts.now);
  result.cap = capOf(profile);
  if (status === "missing") result.failures.push({ code: "profile-missing" });
  if (status === "stale") result.failures.push({ code: "profile-stale" });
  if (profile !== null && typeof profile.generated === "string") {
    result.profile_age_days = ageDays(opts.now, parseTime(profile.generated));
  }
  for (const wf of allWorkflows(register)) {
    const eff: Effective = effectiveLevel(wf, profile, state, register.defaults, opts.now);
    result.workflows.push({ id: wf.id, granted: eff.granted, effective: eff.effective, reasons: eff.reasons });
    if (eff.granted > eff.cap) {
      result.failures.push({ code: "grant-exceeds-cap", workflow: wf.id, granted: eff.granted, cap: eff.cap });
    }
  }
  const tokens = agentTokens(register);
  const commits = opts.commits ?? [];
  commits.forEach((commit, index) => {
    if (!isAgentCommit(commit, tokens)) return;
    const sha = commit.sha.toLowerCase();
    const acknowledger = commits
      .slice(index + 1)
      .find((later) => !isAgentCommit(later, tokens) && approvedPrefixes(later.body).some((p) => sha.startsWith(p)));
    for (const file of commit.files) {
      if (isTier1File(file)) {
        result.failures.push({ code: "governance-file-changed-by-agent", commit: commit.sha, file });
      } else if (isTier2File(file)) {
        if (acknowledger) result.acknowledged.push({ commit: commit.sha, file, by: acknowledger.sha });
        else result.failures.push({ code: "workflow-change-unacknowledged", commit: commit.sha, file });
      }
    }
  });
  result.ok = result.failures.length === 0;
  return result;
}

export function formatCheck(result: CheckResult): string {
  const lines = [`cap: ${result.cap ?? "n/a"}`];
  for (const w of result.workflows) {
    const why = w.reasons.length > 0 ? `  (${w.reasons.join(", ")})` : "";
    lines.push(`workflow ${w.id}: granted ${w.granted}, effective ${w.effective}${why}`);
  }
  for (const a of result.acknowledged) {
    lines.push(`governance: ${a.commit.slice(0, 7)} changed ${a.file} (acknowledged by ${a.by.slice(0, 7)})`);
  }
  for (const f of result.failures) lines.push(`FAIL ${JSON.stringify(f)}`);
  lines.push(result.ok ? "autonomy check: ok" : "autonomy check: FAILED");
  return lines.join("\n");
}
