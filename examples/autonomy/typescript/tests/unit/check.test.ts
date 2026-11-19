import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { commitsFromGit, isAgentCommit, isGovernanceFile, runCheck } from "../../src/check.js";
import type { Commit } from "../../src/check.js";
import { parseTime } from "../../src/util.js";
import { NOW, copyFixture, fixture, readFixtureJson } from "../helpers.js";

const now = parseTime(NOW);

test("check on the valid register matches the shared golden result", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now });
  assert.deepEqual(JSON.parse(JSON.stringify(result)), readFixtureJson("expected", "check-valid.json"));
});

test("check fails when a grant exceeds the cap, matching the shared golden result", () => {
  const result = runCheck({ dir: fixture("registers", "over-cap"), now });
  assert.equal(result.ok, false);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), readFixtureJson("expected", "check-over-cap.json"));
});

test("check fails when the profile is older than 30 days", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now: parseTime("2026-12-20T00:00:00Z") });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.code === "profile-stale"));
});

test("check fails when the profile is missing", () => {
  const dir = copyFixture("registers", "valid");
  execFileSync("rm", [join(dir, ".autonomy", "profile.json")]);
  const result = runCheck({ dir, now });
  assert.deepEqual(result.failures, [
    { code: "profile-missing" },
    { code: "grant-exceeds-cap", workflow: "dep-bump", granted: 4, cap: 2 },
    { code: "grant-exceeds-cap", workflow: "flaky-test-triage", granted: 3, cap: 2 },
    { code: "grant-exceeds-cap", workflow: "interactive", granted: 3, cap: 2 },
  ]);
});

test("check reports schema errors and stops", () => {
  const dir = copyFixture("registers", "valid");
  const text = `version: 1\nworkflows:\n  - id: w\n    owner: t\n    sponsor: s\n    granted_level: 3\n    identity: x\n    exception: waiver\n    risk: { reversible: true, verification: partial, blast_radius: repo, trifecta: { untrusted_input: false, sensitive_data: false, external_action: false } }\n`;
  writeFileSync(join(dir, ".autonomy.yaml"), text);
  const result = runCheck({ dir, now });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, [{ code: "schema", path: "/workflows/0/exception", keyword: "additionalProperties" }]);
});

test("check passes a stale stop test but lowers the effective level", () => {
  const dir = copyFixture("registers", "valid");
  const result = runCheck({ dir, now: parseTime("2026-12-05T00:00:00Z") });
  const dep = result.workflows.find((w) => w.id === "dep-bump");
  assert.equal(result.ok, true);
  assert.deepEqual(dep, { id: "dep-bump", granted: 4, effective: 2, reasons: ["freshness:stop-test-overdue"] });
});

const agentCommit = (files: string[]): Commit => ({ sha: "a1", author: "deps-bot[bot]", email: "bot@example.invalid", files });
const humanCommit = (files: string[]): Commit => ({ sha: "h1", author: "Alice", email: "alice@example.invalid", files });

test("an agent commit that changes .autonomy.yaml fails the check", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now, commits: [agentCommit([".autonomy.yaml"])] });
  assert.deepEqual(result.failures, [{ code: "governance-file-changed-by-agent", commit: "a1", file: ".autonomy.yaml" }]);
});

test("an agent commit that changes CODEOWNERS or a workflow file fails the check", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now, commits: [agentCommit(["docs/CODEOWNERS", ".github/workflows/ci.yml", "src/a.ts"])] });
  assert.deepEqual(result.failures.map((f) => f.file), ["docs/CODEOWNERS", ".github/workflows/ci.yml"]);
});

test("a human commit that changes governance files passes the check", () => {
  const result = runCheck({ dir: fixture("registers", "valid"), now, commits: [humanCommit([".autonomy.yaml", "CODEOWNERS"])] });
  assert.equal(result.ok, true);
});

test("a commit by a register identity or a Claude co-author is an agent commit", () => {
  assert.equal(isAgentCommit({ sha: "x", author: "deps-bot", email: "a@b.c", files: [] }, ["deps-bot"]), true);
  assert.equal(isAgentCommit({ sha: "x", author: "Alice", email: "a@b.c", body: "Co-Authored-By: Claude <x@y.z>", files: [] }, []), true);
  assert.equal(isAgentCommit({ sha: "x", author: "Alice", email: "a@b.c", files: [] }, ["deps-bot"]), false);
});

test("governance file patterns", () => {
  for (const p of [".autonomy.yaml", ".autonomy/state.json", "CODEOWNERS", ".github/CODEOWNERS", ".github/workflows/ci.yml"]) {
    assert.equal(isGovernanceFile(p), true, p);
  }
  for (const p of ["src/autonomy.ts", "docs/autonomy.md", ".github/dependabot.yml"]) assert.equal(isGovernanceFile(p), false, p);
});

test("commitsFromGit reads authors and changed files from a real repository", () => {
  const dir = copyFixture("registers", "valid");
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=deps-bot[bot]", "-c", "user.email=bot@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  appendFileSync(join(dir, ".autonomy.yaml"), "# edited\n");
  git("commit", "-q", "-am", "agent edit");
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files, [".autonomy.yaml"]);
  assert.equal(commits[0].author, "deps-bot[bot]");
  const result = runCheck({ dir, now, commits });
  assert.ok(result.failures.some((f) => f.code === "governance-file-changed-by-agent"));
});
