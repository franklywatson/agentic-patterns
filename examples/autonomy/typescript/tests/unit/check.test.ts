import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { approvedPrefixes, commitsFromGit, formatCheck, isAgentCommit, isGovernanceFile, isTier1File, isTier2File, runCheck } from "../../src/check.js";
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
  assert.deepEqual(result.failures.map((f) => [f.code, f.file]), [
    ["governance-file-changed-by-agent", "docs/CODEOWNERS"],
    ["workflow-change-unacknowledged", ".github/workflows/ci.yml"],
  ]);
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

test("a commit body containing @@ and unit separators is parsed intact", () => {
  const dir = copyFixture("registers", "valid");
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=Alice", "-c", "user.email=alice@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  appendFileSync(join(dir, ".autonomy.yaml"), "# edited\n");
  git("commit", "-q", "-am", "edit\n\n@@ hunk @@ in the body\nCo-Authored-By: Claude <c@example.invalid>");
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files, [".autonomy.yaml"]);
  assert.match(commits[0].body ?? "", /@@ hunk @@ in the body/);
  assert.equal(isAgentCommit(commits[0], []), true);
});

test("a rename out of a governed path still lists the old path", () => {
  const dir = copyFixture("registers", "valid");
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), "name: ci\non: push\njobs: {}\n");
  const git = (...args: string[]) => execFileSync("git", ["-c", "user.name=deps-bot[bot]", "-c", "user.email=bot@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-q", "-m", "base");
  mkdirSync(join(dir, "elsewhere"));
  git("mv", ".github/workflows/ci.yml", "elsewhere/ci.yml");
  git("commit", "-q", "-m", "move");
  const commits = commitsFromGit(dir, "HEAD~1..HEAD");
  assert.deepEqual([...commits[0].files].sort(), [".github/workflows/ci.yml", "elsewhere/ci.yml"]);
  const result = runCheck({ dir, now, commits });
  assert.deepEqual(result.failures, [{ code: "workflow-change-unacknowledged", commit: commits[0].sha, file: ".github/workflows/ci.yml" }]);
});

test("commitsFromGit rejects ranges that are not revisions", () => {
  assert.throws(() => commitsFromGit(fixture("registers", "valid"), "--output=x"), /invalid git range/);
  assert.throws(() => commitsFromGit(fixture("registers", "valid"), "a b"), /invalid git range/);
});

test("governance patterns are case-insensitive and cover hook configuration", () => {
  for (const p of [".AUTONOMY.yaml", "codeowners", "Docs/CodeOwners", ".GitHub/Workflows/ci.yml", ".claude/settings.json", ".claude/settings.local.json", ".claude/hooks/guard.sh", ".harness.yaml"]) {
    assert.equal(isGovernanceFile(p), true, p);
  }
  assert.equal(isGovernanceFile(".claude/commands/review.md"), false);
});

test("a profile path that escapes the repository is an error", () => {
  const dir = copyFixture("registers", "valid");
  const path = join(dir, ".autonomy.yaml");
  writeFileSync(path, readFileSync(path, "utf8").replace("profile: .autonomy/profile.json", "profile: ../../elsewhere/profile.json"));
  assert.throws(() => runCheck({ dir, now }), /escapes the repository/);
});

test("an impossible calendar date is a schema error, not a crash", () => {
  const dir = copyFixture("registers", "valid");
  const path = join(dir, ".autonomy.yaml");
  writeFileSync(path, readFileSync(path, "utf8").replace("review_date: 2027-02-01", "review_date: 2027-02-31"));
  const result = runCheck({ dir, now });
  assert.deepEqual(result.failures, [{ code: "schema", path: "/workflows/0/review_date", keyword: "format" }]);
});

const commitsFixture = (name: string): Commit[] => readFixtureJson("commits", `${name}.json`);
const checkCommits = (name: string) => runCheck({ dir: fixture("registers", "valid"), now, commits: commitsFixture(name) });
const A1 = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const A2 = "b2c3d4e5f60718293a4b5c6d7e8f901234567890";
const H1 = "c3d4e5f60718293a4b5c6d7e8f90123456789012";
const unacknowledged = (commit: string, file: string) => ({ code: "workflow-change-unacknowledged", commit, file });

test("a tier 1 file still fails when a later human commit carries an acknowledgement line", () => {
  const result = checkCommits("governance-tier1-with-ack");
  assert.deepEqual(result.failures, [{ code: "governance-file-changed-by-agent", commit: A1, file: ".autonomy.yaml" }]);
  assert.deepEqual(result.acknowledged, []);
});

test("an unacknowledged agent change to a workflow fails with workflow-change-unacknowledged", () => {
  assert.deepEqual(checkCommits("governance-tier2-unacknowledged").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("a workflow change acknowledged by a later human commit passes and is reported", () => {
  const result = checkCommits("governance-tier2-acknowledged");
  assert.equal(result.ok, true);
  assert.deepEqual(result.acknowledged, [{ commit: A1, file: ".github/workflows/ci.yml", by: H1 }]);
  assert.match(formatCheck(result), /^governance: a1b2c3d changed \.github\/workflows\/ci\.yml \(acknowledged by c3d4e5f\)$/m);
});

test("an acknowledgement by an agent commit does not count", () => {
  assert.deepEqual(checkCommits("governance-tier2-ack-by-agent").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("an acknowledgement that comes before the agent commit does not count", () => {
  assert.deepEqual(checkCommits("governance-tier2-ack-before").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("an acknowledgement with a 6 character prefix does not count", () => {
  assert.deepEqual(checkCommits("governance-tier2-ack-short-prefix").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("an acknowledgement for a different sha does not count", () => {
  assert.deepEqual(checkCommits("governance-tier2-ack-wrong-sha").failures, [unacknowledged(A1, ".github/workflows/ci.yml")]);
});

test("a case-variant workflow path is tier 2", () => {
  assert.equal(isTier2File(".GitHub/Workflows/x.yml"), true);
  assert.equal(isTier1File(".GitHub/Workflows/x.yml"), false);
  assert.deepEqual(checkCommits("governance-tier2-case-variant").failures, [unacknowledged(A1, ".GitHub/Workflows/x.yml")]);
});

test("with two agent commits, only the acknowledged one passes", () => {
  const result = checkCommits("governance-tier2-two-agents-one-acked");
  assert.deepEqual(result.failures, [unacknowledged(A2, ".github/workflows/release.yml")]);
  assert.deepEqual(result.acknowledged, [{ commit: A1, file: ".github/workflows/ci.yml", by: H1 }]);
});

test("acknowledgement lines are parsed strictly", () => {
  assert.deepEqual(approvedPrefixes("x\nGovernance-Approved: a1b2c3d\ngovernance-approved:A1B2C3D4"), ["a1b2c3d", "a1b2c3d4"]);
  assert.deepEqual(approvedPrefixes("Governance-Approved: a1b2c3\nGovernance-Approved: a1b2c3dzz\n see Governance-Approved: a1b2c3d"), []);
});

test("commitsFromGit lists commits oldest first so a later acknowledgement is found", () => {
  const dir = copyFixture("registers", "valid");
  mkdirSync(join(dir, ".github", "workflows"), { recursive: true });
  const git = (name: string, ...args: string[]) => execFileSync("git", ["-c", `user.name=${name}`, "-c", "user.email=a@example.invalid", ...args], { cwd: dir, stdio: "ignore" });
  git("Alice", "init", "-q");
  git("Alice", "add", "-A");
  git("Alice", "commit", "-q", "-m", "base");
  writeFileSync(join(dir, ".github", "workflows", "ci.yml"), "name: ci\non: push\njobs: {}\n");
  git("deps-bot[bot]", "add", "-A");
  git("deps-bot[bot]", "commit", "-q", "-m", "add ci");
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  git("Alice", "commit", "-q", "--allow-empty", "-m", `approve\n\nGovernance-Approved: ${sha.slice(0, 7)}`);
  const commits = commitsFromGit(dir, "HEAD~2..HEAD");
  assert.equal(commits[0].sha, sha);
  const result = runCheck({ dir, now, commits });
  assert.equal(result.ok, true);
  assert.equal(result.acknowledged.length, 1);
});
