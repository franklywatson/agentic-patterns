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
  committer?: string;
  committer_email?: string;
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

const ACK_LINE = /^governance-approved:[ \t]*([0-9a-f]{7,40})$/i;

/** Hex prefixes named by whole-line `Governance-Approved: <sha>` lines in the body (not the subject line). */
export function approvedPrefixes(body: string | undefined): string[] {
  const prefixes: string[] = [];
  for (const line of (body ?? "").split("\n").slice(1)) {
    const m = ACK_LINE.exec(line);
    if (m) prefixes.push(m[1].toLowerCase());
  }
  return prefixes;
}

export function agentTokens(register: Json): string[] {
  return (register.workflows ?? [])
    .map((w: Json) => String(w.identity ?? ""))
    .filter((id: string) => id.includes(":") && !id.startsWith("person:"))
    .map((id: string) => id.slice(id.indexOf(":") + 1).toLowerCase());
}

const CO_AUTHOR_AGENT = /^co-authored-by:[\s\S]*(claude|anthropic)/i;

export function isAgentCommit(commit: Commit, tokens: string[]): boolean {
  const who = `${commit.author} ${commit.email} ${commit.committer ?? ""} ${commit.committer_email ?? ""}`.toLowerCase();
  if (who.includes("[bot]")) return true;
  if (tokens.some((t) => who.includes(t))) return true;
  return (commit.body ?? "").split("\n").some((line) => CO_AUTHOR_AGENT.test(line));
}

const RANGE = /^[\w./^~@{:+][\w./^~@{}:+-]*(\.\.\.?[\w./^~@{}:+-]+)?$/;
const SHA = /^([0-9a-f]{40}|[0-9a-f]{64})$/;

/**
 * Commits in the range, oldest first. Each commit is read in its own git call and parsed by NUL, which git
 * refuses in a message, so a message cannot forge a record. Paths are read with -z and quotePath off, and a
 * merge lists what it changed beyond the automatic merge (remerge).
 */
export function commitsFromGit(dir: string, range: string): Commit[] {
  if (!RANGE.test(range)) throw new Error(`invalid git range: ${range}`);
  const list = git(dir, ["rev-list", "--reverse", range]);
  if (list === null) throw new Error(`git rev-list failed for range ${range}`);
  const commits: Commit[] = [];
  for (const sha of list.split("\n").filter(Boolean)) {
    if (!SHA.test(sha)) throw new Error(`git returned a malformed sha: ${sha}`);
    const meta = git(dir, ["-c", "core.quotePath=false", "show", "-s", "--format=%an%x00%ae%x00%cn%x00%ce%x00%B", sha]);
    const names = git(dir, ["-c", "core.quotePath=false", "show", "-z", "--name-only", "--no-renames", "--diff-merges=remerge", "--format=", sha]);
    if (meta === null || names === null) throw new Error(`git show failed for ${sha}`);
    const [author, email, committer, committer_email, ...body] = meta.split("\0");
    commits.push({ sha, author, email, committer, committer_email, body: body.join("\0"), files: names.split("\0").filter(Boolean) });
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
  const agentShas = commits.filter((c) => isAgentCommit(c, tokens)).map((c) => c.sha.toLowerCase());
  commits.forEach((commit, index) => {
    if (!isAgentCommit(commit, tokens)) return;
    const sha = commit.sha.toLowerCase();
    const names = (prefix: string) => agentShas.filter((other) => other.startsWith(prefix)).length;
    const acknowledger = commits
      .slice(index + 1)
      .find((later) => !isAgentCommit(later, tokens) && approvedPrefixes(later.body).some((p) => sha.startsWith(p) && names(p) === 1));
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
