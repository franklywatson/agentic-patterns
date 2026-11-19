import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { allWorkflows, effectiveLevel, capOf, profileStatus } from "./levels.js";
import type { Effective } from "./levels.js";
import { loadRegisterFile, validateRegister } from "./register.js";
import { ageDays, git, parseTime, readJsonIfExists } from "./util.js";
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

export interface CheckResult {
  ok: boolean;
  cap: number | null;
  profile_age_days: number | null;
  workflows: Array<{ id: string; granted: number; effective: number; reasons: string[] }>;
  failures: Failure[];
}

export interface Commit {
  sha: string;
  author: string;
  email: string;
  body?: string;
  files: string[];
}

const GOVERNANCE = [/^\.autonomy/, /(^|\/)CODEOWNERS$/, /^\.github\/workflows\//];

export function isGovernanceFile(path: string): boolean {
  return GOVERNANCE.some((re) => re.test(path));
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

export function commitsFromGit(dir: string, range: string): Commit[] {
  const out = git(dir, ["log", "--name-only", "--format=@@%H%x1f%an%x1f%ae%x1f%b%x1e", range]);
  if (out === null) throw new Error(`git log failed for range ${range}`);
  const commits: Commit[] = [];
  for (const chunk of out.split("@@").filter((c) => c.trim() !== "")) {
    const [head, filesText] = chunk.split("\x1e");
    const [sha, author, email, body] = head.split("\x1f");
    commits.push({ sha, author, email, body, files: filesText.split("\n").filter(Boolean) });
  }
  return commits;
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
  const result: CheckResult = { ok: true, cap: null, profile_age_days: null, workflows: [], failures: [] };
  const register = loadRegisterFile(registerPath);
  const schemaErrors = validateRegister(register);
  for (const e of schemaErrors) result.failures.push({ code: "schema", path: e.path, keyword: e.keyword });
  if (schemaErrors.length > 0) {
    result.ok = false;
    return result;
  }
  const profilePath = join(dir, register.profile ?? ".autonomy/profile.json");
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
  for (const commit of opts.commits ?? []) {
    if (!isAgentCommit(commit, tokens)) continue;
    for (const file of commit.files.filter(isGovernanceFile)) {
      result.failures.push({ code: "governance-file-changed-by-agent", commit: commit.sha, file });
    }
  }
  result.ok = result.failures.length === 0;
  return result;
}

export function formatCheck(result: CheckResult): string {
  const lines = [`cap: ${result.cap ?? "n/a"}`];
  for (const w of result.workflows) {
    const why = w.reasons.length > 0 ? `  (${w.reasons.join(", ")})` : "";
    lines.push(`workflow ${w.id}: granted ${w.granted}, effective ${w.effective}${why}`);
  }
  for (const f of result.failures) lines.push(`FAIL ${JSON.stringify(f)}`);
  lines.push(result.ok ? "autonomy check: ok" : "autonomy check: FAILED");
  return lines.join("\n");
}
